import { describe, expect, it } from "vitest";

import type { WatchlistDocument, WatchlistReceipt } from "@/domain/account/watchlist";
import { CancellationError, ErrorCoordinator, type UpgradeReason } from "@/domain/errors";

import { WatchlistChangedError, type WatchlistRepository, WatchlistStore } from "./watchlist-store";

/** Held until released; `started` resolves once the operation reached it. */
class Gate {
  private open!: () => void;
  private reached!: () => void;
  readonly started = new Promise<void>((resolve) => (this.reached = resolve));
  private readonly opened = new Promise<void>((resolve) => (this.open = resolve));
  async pass() {
    this.reached();
    await this.opened;
  }
  release() {
    this.open();
  }
}

type Row = { sortOrder: number; automatic: boolean; createdAt: string };

const transport = () => Object.assign(new Error("Load failed"), { name: "TypeError", message: "Failed to fetch" });

/** `watchlist_items` of one account, as the contract describes it (contract §4.1). */
class MemoryRepository implements WatchlistRepository {
  userID = "user-1";
  readonly rows = new Map<string, Row>();
  readonly mutations: string[] = [];
  inserts = 0;
  reads = 0;
  failOrder = false;
  failDelete = false;
  failRestore = false;
  failNextMembership: unknown = null;
  failNextRead = false;
  readonly gates: Partial<Record<"read" | "remove" | "restore" | `add-${string}`, Gate>> = {};
  /** Applied while a held read is answered: another device's change. */
  external: string | null = null;

  constructor(ids: string[]) {
    ids.forEach((id, index) => this.rows.set(id, { sortOrder: index + 4, automatic: false, createdAt: `2026-10-0${index + 1}T09:00:00Z` }));
  }

  private ordered() {
    return [...this.rows].sort((a, b) => a[1].sortOrder - b[1].sortOrder || a[1].createdAt.localeCompare(b[1].createdAt)).map(([id]) => id);
  }

  async read(): Promise<WatchlistDocument> {
    this.reads += 1;
    const gate = this.gates.read;
    delete this.gates.read;
    await gate?.pass();
    if (this.external) this.rows.set(this.external, { sortOrder: 99, automatic: true, createdAt: "2026-11-01T00:00:00Z" });
    if (this.failNextRead) {
      this.failNextRead = false;
      throw transport();
    }
    return { items: this.ordered().map((id) => ({ id, automaticAlerts: this.rows.get(id)!.automatic })), groups: [], access: null, sensitivity: "normal" };
  }

  async add(id: string) {
    this.mutations.push(`add ${id}`);
    await this.gates[`add-${id}`]?.pass();
    if (this.failNextMembership) {
      const error = this.failNextMembership;
      this.failNextMembership = null;
      throw error;
    }
    if (this.rows.has(id)) return;
    this.inserts += 1;
    this.rows.set(id, { sortOrder: 10, automatic: true, createdAt: "2026-11-11T09:00:00Z" });
  }

  async remove(id: string): Promise<WatchlistReceipt | null> {
    this.mutations.push(`remove ${id}`);
    await this.gates.remove?.pass();
    if (this.failDelete) throw transport();
    const row = this.rows.get(id);
    this.rows.delete(id);
    return row ? { userID: this.userID, securityID: id, sortOrder: row.sortOrder, automaticAlertsEnabled: row.automatic, createdAt: row.createdAt } : null;
  }

  async restore(receipt: WatchlistReceipt) {
    this.mutations.push(`restore ${receipt.securityID}`);
    await this.gates.restore?.pass();
    if (receipt.userID !== this.userID) throw new CancellationError();
    if (this.failRestore) throw transport();
    if (this.rows.has(receipt.securityID)) throw Object.assign(new Error("duplicate"), { code: "23505", message: "duplicate key", details: null, hint: null });
    this.inserts += 1;
    this.rows.set(receipt.securityID, { sortOrder: receipt.sortOrder, automatic: receipt.automaticAlertsEnabled, createdAt: receipt.createdAt });
  }

  async reorder(ids: readonly string[]) {
    this.mutations.push(`order ${ids.join(",")}`);
    if (this.failOrder) throw transport();
    if ([...ids].sort().join() !== [...this.rows.keys()].sort().join()) throw new WatchlistChangedError();
    ids.forEach((id, index) => (this.rows.get(id)!.sortOrder = index));
  }

  async setAutomatic(id: string, enabled: boolean) {
    this.mutations.push(`automatic ${id} ${enabled}`);
    this.rows.get(id)!.automatic = enabled;
  }

  createGroup = async () => {};
  renameGroup = async () => {};
  deleteGroup = async () => {};
  setGroupMember = async () => {};
  selectFree = async () => null;
  setSensitivity = async () => {};
}

function fixture(ids: string[], initial = ids) {
  const repository = new MemoryRepository(ids);
  const errors = new ErrorCoordinator();
  const upgrades: UpgradeReason[] = [];
  const store = new WatchlistStore(repository, errors, initial, { upgrade: (reason) => upgrades.push(reason) });
  return { repository, errors, store, upgrades, order: () => store.getSnapshot().order };
}

const FREE_LIMIT = { code: "P0001", message: "FREE_WATCHLIST_LIMIT", details: '{"feature":"watchlist","limit":3}', hint: null, status: 400 };

// Ported from iOS WatchlistStoreTests.
describe("WatchlistStore", () => {
  it("saves changes in the order they were made", async () => {
    const { repository, store } = fixture(["AAA", "BBB"]);
    store.setWatched("AAA", false);
    store.setWatched("CCC", true);
    store.setOrder(["CCC", "BBB"]);
    await store.settled();
    expect(repository.mutations).toEqual(["remove AAA", "add CCC", "order CCC,BBB"]);
  });

  it("a failed reorder keeps a confirmed addition", async () => {
    const { repository, errors, store, order } = fixture(["AAA", "BBB"]);
    store.setWatched("CCC", true);
    await store.settled();
    repository.failOrder = true;
    store.setOrder(["CCC", "BBB", "AAA"]);
    await store.settled();
    expect(order()).toEqual(["AAA", "BBB", "CCC"]);
    expect(errors.current).not.toBeNull();
  });

  it("a failed reorder does not bring back a confirmed removal", async () => {
    const { repository, store, order } = fixture(["AAA", "BBB", "CCC"]);
    store.setWatched("BBB", false);
    await store.settled();
    repository.failOrder = true;
    store.setOrder(["CCC", "AAA"]);
    await store.settled();
    expect(order()).toEqual(["AAA", "CCC"]);
  });

  it("a failed reorder keeps the position of a removed and re-added item", async () => {
    const { repository, store, order } = fixture(["AAA", "BBB"]);
    store.setWatched("AAA", false);
    store.setWatched("AAA", true);
    await store.settled();
    repository.failOrder = true;
    store.setOrder(["AAA", "BBB"]);
    await store.settled();
    expect(order()).toEqual(["BBB", "AAA"]);
  });

  it("the Free limit opens the plan dialog instead of a toast and retries the same save", async () => {
    const { repository, errors, store, upgrades, order } = fixture(["AAA"]);
    repository.failNextMembership = FREE_LIMIT;
    store.setWatched("BBB", true);
    await store.settled();
    expect(upgrades).toEqual(["watchlist"]);
    expect(errors.current).toBeNull();
    expect(order()).toEqual(["AAA"]);
    await store.takeLimitRetry()!();
    expect(order()).toEqual(["AAA", "BBB"]);
    expect(repository.mutations).toEqual(["add BBB", "add BBB"]);
  });

  it("a failed reorder keeps membership confirmed by a retry", async () => {
    const { repository, errors, store, order } = fixture(["AAA", "BBB"]);
    repository.failNextMembership = transport();
    store.setWatched("CCC", true);
    await store.settled();
    expect(order()).toEqual(["AAA", "BBB"]);
    await errors.retryCurrent();
    expect(errors.current).toBeNull();
    repository.failOrder = true;
    store.setOrder(["CCC", "AAA", "BBB"]);
    await store.settled();
    expect(order()).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("a read overtaken by a write is repeated, with changes from another device", async () => {
    const { repository, store } = fixture(["AAA"]);
    const read = (repository.gates.read = new Gate());
    const loading = store.load(true);
    await read.started;
    store.setWatched("BBB", true);
    await store.settled();
    repository.external = "CCC";
    read.release();
    expect(await loading).toBe(true);
    expect(store.getSnapshot().status).toBe("loaded");
    expect(new Set(store.getSnapshot().order)).toEqual(new Set(["AAA", "BBB", "CCC"]));
  });

  it("a reset during a read cannot load the previous account", async () => {
    const { repository, store } = fixture(["AAA"]);
    const read = (repository.gates.read = new Gate());
    const loading = store.load(true);
    await read.started;
    store.reset();
    repository.external = "CCC";
    read.release();
    expect(await loading).toBe(false);
    expect(store.getSnapshot().status).toBe("idle");
    expect(store.getSnapshot().order).toEqual([]);
  });

  it("the read waits for a write queued while it waited for an earlier one", async () => {
    const { repository, store } = fixture([]);
    const read = (repository.gates.read = new Gate());
    const first = (repository.gates["add-AAA"] = new Gate());
    const second = (repository.gates["add-BBB"] = new Gate());
    const loading = store.load(true);
    await read.started;
    store.setWatched("AAA", true);
    await first.started;
    read.release();
    await Promise.resolve();
    store.setWatched("BBB", true);
    first.release();
    await second.started;
    const readsBefore = repository.reads;
    second.release();
    await loading;
    expect(repository.reads).toBe(readsBefore + 1);
    expect(new Set(store.getSnapshot().order)).toEqual(new Set(["AAA", "BBB"]));
  });

  it("a failed read overtaken by a write reads the current membership", async () => {
    const { repository, store } = fixture([]);
    const read = (repository.gates.read = new Gate());
    repository.failNextRead = true;
    const loading = store.load(true);
    await read.started;
    store.setWatched("AAA", true);
    await store.settled();
    read.release();
    expect(await loading).toBe(true);
    expect(store.getSnapshot().order).toEqual(["AAA"]);
  });

  it("a reorder refused because membership changed reloads the list", async () => {
    const { repository, errors, store, order } = fixture(["AAA", "BBB"]);
    repository.rows.set("CCC", { sortOrder: 20, automatic: true, createdAt: "2026-11-02T00:00:00Z" });
    store.setOrder(["BBB", "AAA"]);
    await store.settled();
    await store.load();
    expect(errors.current).toBeNull();
    expect(order()).toEqual(["AAA", "BBB", "CCC"]);
  });
});

// Ported from iOS WatchlistUndoTests.
describe("WatchlistStore undo", () => {
  it("restores the deleted row's flags, sort order and position", async () => {
    const { repository, store, order } = fixture(["AAA", "BBB"]);
    const handle = store.removeForUndo("AAA")!;
    await store.settled();
    expect(store.getSnapshot().undo).toBe(handle);
    store.undo(handle);
    await store.settled();
    expect(repository.rows.get("AAA")).toEqual({ sortOrder: 4, automatic: false, createdAt: "2026-10-01T09:00:00Z" });
    expect(order()).toEqual(["AAA", "BBB"]);
    expect(store.getSnapshot().undo).toBeNull();
  });

  it("waits for a delayed removal and restores the deleted values", async () => {
    const { repository, store } = fixture(["AAA", "BBB"]);
    const remove = (repository.gates.remove = new Gate());
    const handle = store.removeForUndo("AAA")!;
    await remove.started;
    store.undo(handle);
    expect(repository.inserts).toBe(0);
    remove.release();
    await store.settled();
    expect(repository.rows.get("AAA")?.sortOrder).toBe(4);
  });

  it("a failed removal cannot create a row", async () => {
    const { repository, store, order } = fixture(["AAA", "BBB"]);
    repository.failDelete = true;
    const handle = store.removeForUndo("AAA")!;
    store.undo(handle);
    await store.settled();
    expect(repository.inserts).toBe(0);
    expect(order()).toEqual(["AAA", "BBB"]);
  });

  it("an empty delete offers nothing to restore", async () => {
    const { repository, store } = fixture(["AAA", "BBB"]);
    repository.rows.delete("AAA");
    const handle = store.removeForUndo("AAA")!;
    await store.settled();
    store.undo(handle);
    await store.settled();
    expect(repository.rows.has("AAA")).toBe(false);
    expect(repository.inserts).toBe(0);
  });

  it("a newer change invalidates the undo", async () => {
    const { repository, store } = fixture(["AAA", "BBB"]);
    const handle = store.removeForUndo("AAA")!;
    await store.settled();
    store.setWatched("AAA", true);
    await store.settled();
    const count = repository.mutations.length;
    store.undo(handle);
    await store.settled();
    expect(repository.mutations).toHaveLength(count);
    expect(repository.rows.get("AAA")).toMatchObject({ automatic: true, sortOrder: 10 });
  });

  it("a reorder invalidates the undo before the removal completes", async () => {
    const { repository, store, order } = fixture(["AAA", "BBB"]);
    const remove = (repository.gates.remove = new Gate());
    const handle = store.removeForUndo("AAA")!;
    await remove.started;
    store.setOrder(["BBB"]);
    store.undo(handle);
    remove.release();
    await store.settled();
    expect(repository.rows.has("AAA")).toBe(false);
    expect(order()).toEqual(["BBB"]);
  });

  it("an account reset rejects a delayed removal and its undo", async () => {
    const { repository, errors, store } = fixture(["AAA", "BBB"]);
    const remove = (repository.gates.remove = new Gate());
    const handle = store.removeForUndo("AAA")!;
    await remove.started;
    store.reset();
    repository.userID = "user-2";
    store.undo(handle);
    remove.release();
    await store.settled();
    expect(repository.inserts).toBe(0);
    expect(store.getSnapshot().order).toEqual([]);
    expect(errors.current).toBeNull();
  });

  it("a failed restoration retries with the same deleted values", async () => {
    const { repository, errors, store } = fixture(["AAA", "BBB"]);
    const handle = store.removeForUndo("AAA")!;
    await store.settled();
    repository.failRestore = true;
    store.undo(handle);
    await store.settled();
    expect(repository.rows.has("AAA")).toBe(false);
    expect(errors.current).not.toBeNull();
    repository.failRestore = false;
    await errors.retryCurrent();
    expect(repository.rows.get("AAA")).toMatchObject({ automatic: false, sortOrder: 4 });
    expect(store.getSnapshot().order).toEqual(["AAA", "BBB"]);
  });

  it("an undo in flight and a new addition both apply", async () => {
    const { repository, store, order } = fixture(["AAA", "BBB"]);
    const handle = store.removeForUndo("AAA")!;
    await store.settled();
    const restore = (repository.gates.restore = new Gate());
    store.undo(handle);
    await restore.started;
    store.setWatched("CCC", true);
    restore.release();
    await store.settled();
    expect(repository.rows.get("AAA")?.automatic).toBe(false);
    expect(repository.rows.has("CCC")).toBe(true);
    expect(order()).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("a reorder saves the full membership after an undo in flight", async () => {
    const { repository, errors, store, order } = fixture(["AAA", "BBB"]);
    const handle = store.removeForUndo("AAA")!;
    await store.settled();
    const restore = (repository.gates.restore = new Gate());
    store.undo(handle);
    await restore.started;
    store.setOrder(["BBB"]);
    restore.release();
    await store.settled();
    expect(errors.current).toBeNull();
    expect(order()).toEqual(["BBB", "AAA"]);
    expect(repository.rows.get("BBB")?.sortOrder).toBe(0);
    expect(repository.rows.get("AAA")?.sortOrder).toBe(1);
  });

  it("a newer removal wins after an undo in flight", async () => {
    const { repository, store, order } = fixture(["AAA", "BBB"]);
    const handle = store.removeForUndo("AAA")!;
    await store.settled();
    const restore = (repository.gates.restore = new Gate());
    store.undo(handle);
    await restore.started;
    store.setWatched("AAA", false);
    restore.release();
    await store.settled();
    expect(repository.rows.has("AAA")).toBe(false);
    expect(order()).toEqual(["BBB"]);
  });

  it("a newer change discards a failed undo's retry", async () => {
    const { repository, errors, store } = fixture(["AAA", "BBB"]);
    const handle = store.removeForUndo("AAA")!;
    await store.settled();
    repository.failRestore = true;
    store.undo(handle);
    await store.settled();
    repository.failRestore = false;
    store.setWatched("AAA", true);
    await store.settled();
    const inserts = repository.inserts;
    await errors.retryCurrent();
    expect(repository.inserts).toBe(inserts);
    expect(repository.rows.get("AAA")?.automatic).toBe(true);
    expect(errors.current).toBeNull();
  });
});
