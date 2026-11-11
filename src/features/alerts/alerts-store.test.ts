import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import type { AlertRule } from "@/domain/account/alerts";
import { ErrorCoordinator, type UpgradeReason } from "@/domain/errors";

import { type AlertRepository, AlertsStore } from "./alerts-store";

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

const transport = () => Object.assign(new Error("Failed to fetch"), { name: "TypeError" });
const rule = (id: string, createdAt = 1): AlertRule => ({ id, securityID: "BAI", kind: "price_above", threshold: new Decimal(100), isEnabled: true, createdAt });

/** `notification_rules`, with numbered reads and creates that can be held or failed. */
class MemoryRules implements AlertRepository {
  rows = new Map<string, AlertRule>();
  readonly events: string[] = [];
  reads = 0;
  creates = 0;
  readGates = new Map<number, Gate>();
  createGates = new Map<number, Gate>();
  failingCreates = new Set<number>();
  failingReads = new Set<number>();
  /** A write that reaches the server but whose answer is lost (a timeout). */
  timeOutAfterWrite = false;
  createError: unknown = null;

  constructor(rules: AlertRule[] = []) {
    for (const item of rules) this.rows.set(item.id, item);
  }

  async read() {
    const number = ++this.reads;
    await this.readGates.get(number)?.pass();
    this.events.push(`read-${number}`);
    if (this.failingReads.has(number)) throw transport();
    return [...this.rows.values()];
  }

  async create(item: AlertRule) {
    const number = ++this.creates;
    await this.createGates.get(number)?.pass();
    if (this.failingCreates.has(number)) throw transport();
    if (this.createError) throw this.createError;
    if (!this.rows.has(item.id)) this.rows.set(item.id, item);
    this.events.push(`create-${number}-finished`);
    if (this.timeOutAfterWrite) {
      this.timeOutAfterWrite = false;
      throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    }
  }

  async update(item: AlertRule) {
    this.rows.set(item.id, item);
  }

  async delete(id: string) {
    this.rows.delete(id);
  }
}

function fixture(repository: MemoryRules) {
  const errors = new ErrorCoordinator();
  const upgrades: UpgradeReason[] = [];
  const store = new AlertsStore(repository, errors, (reason) => upgrades.push(reason));
  return { store, errors, upgrades, ids: () => store.getSnapshot().rules.map((item) => item.id) };
}

// Ported from iOS MarketAlertsStoreTests.
describe("AlertsStore", () => {
  it("creates an enabled rule and reports the save only once persisted", async () => {
    const { store } = fixture(new MemoryRules());
    let saved: boolean | undefined;
    void store.create("BAI", "price_above", new Decimal(70_000)).then((value) => (saved = value));
    expect(store.rulesFor("BAI")).toMatchObject([{ kind: "price_above", isEnabled: true }]);
    expect(saved).toBeUndefined();
    await store.settled();
    expect(saved).toBe(true);
  });

  it("a failed save reports failure and restores the list", async () => {
    const repository = new MemoryRules();
    repository.failingCreates.add(1);
    const { store, errors } = fixture(repository);
    expect(await store.create("BAI", "price_above", new Decimal(70_000))).toBe(false);
    expect(store.getSnapshot().rules).toEqual([]);
    expect(errors.current?.retry).toBeTruthy();
  });

  it("pausing keeps the rule and counts only enabled ones", async () => {
    const repository = new MemoryRules([rule("a", 2), rule("b", 1)]);
    const { store } = fixture(repository);
    await store.load();
    store.setEnabled("a", false);
    await store.settled();
    expect(store.rulesFor("BAI").filter((item) => item.isEnabled).map((item) => item.id)).toEqual(["b"]);
    expect(repository.rows.get("a")?.isEnabled).toBe(false);
  });

  it("rejects thresholds the server would refuse", async () => {
    const { store, errors } = fixture(new MemoryRules());
    expect(await store.create("BAI", "volume_above_average", new Decimal(25))).toBe(false);
    expect(store.getSnapshot().rules).toEqual([]);
    expect(errors.current?.error.category).toBe("validation");
  });

  it("a save repeated after a timeout creates one row", async () => {
    const repository = new MemoryRules();
    repository.timeOutAfterWrite = true;
    const { store, errors } = fixture(repository);
    await store.create("BAI", "price_above", new Decimal(120));
    expect(errors.current?.retry).toBeTruthy();
    await errors.retryCurrent();
    expect(repository.rows.size).toBe(1);
    expect(store.getSnapshot().rules).toHaveLength(1);
    expect(errors.current).toBeNull();
  });

  it("the Free rule limit opens the plan dialog instead of a toast", async () => {
    const repository = new MemoryRules();
    repository.createError = { code: "P0001", message: "PLUS_REQUIRED", details: '{"feature":"alert_rules","limit":2}', hint: null, status: 400 };
    const { store, errors, upgrades } = fixture(repository);
    await store.create("BAI", "price_above", new Decimal(120));
    expect(upgrades).toEqual(["alerts"]);
    expect(errors.current).toBeNull();
  });
});

// Ported from iOS MarketAlertsLoadRaceTests.
describe("AlertsStore load races", () => {
  it("the first read is repeated after a rule is created meanwhile", async () => {
    const repository = new MemoryRules([rule("existing")]);
    const read = new Gate();
    repository.readGates.set(1, read);
    const { store, ids } = fixture(repository);
    const loading = store.load();
    await read.started;
    void store.create("BAI", "price_above", new Decimal(120));
    const created = ids()[0];
    await store.settled();
    read.release();
    await loading;
    expect(new Set(ids())).toEqual(new Set(["existing", created]));
    expect(store.getSnapshot().status).toBe("loaded");
    expect(repository.reads).toBe(2);
  });

  it("the replacement read waits for every queued write", async () => {
    const repository = new MemoryRules([rule("existing")]);
    const read = new Gate();
    const first = new Gate();
    const second = new Gate();
    repository.readGates.set(1, read);
    repository.createGates.set(1, first);
    repository.createGates.set(2, second);
    const { store } = fixture(repository);
    const loading = store.load();
    await read.started;
    void store.create("BAI", "price_above", new Decimal(120));
    await first.started;
    void store.create("BAI", "price_below", new Decimal(80));
    read.release();
    first.release();
    await second.started;
    second.release();
    await loading;
    await store.settled();
    expect(store.getSnapshot().rules).toHaveLength(3);
    expect(repository.events.filter((event) => event.startsWith("read-"))).toEqual(["read-1", "read-2"]);
    expect(repository.events.indexOf("create-2-finished")).toBeLessThan(repository.events.indexOf("read-2"));
  });

  it("a reload does not bring back a deleted rule", async () => {
    const repository = new MemoryRules([rule("deleted", 2), rule("survivor", 1)]);
    const read = new Gate();
    const { store, ids } = fixture(repository);
    await store.load();
    repository.readGates.set(2, read);
    const loading = store.load(undefined, true);
    await read.started;
    store.delete("deleted");
    await store.settled();
    read.release();
    await loading;
    expect(ids()).toEqual(["survivor"]);
  });

  it("a failed write and a failed first read still end loaded, without retrying the write", async () => {
    const repository = new MemoryRules([rule("existing")]);
    const read = new Gate();
    repository.readGates.set(1, read);
    repository.failingCreates.add(1);
    repository.failingReads.add(1);
    const { store, errors, ids } = fixture(repository);
    const loading = store.load();
    await read.started;
    void store.create("BAI", "price_above", new Decimal(120));
    await store.settled();
    read.release();
    await loading;
    expect(ids()).toEqual(["existing"]);
    expect(store.getSnapshot().status).toBe("loaded");
    expect(errors.current?.retry).toBeTruthy();
    expect(repository.creates).toBe(1);
  });

  it("an explicit retry joins the queue before the replacement read", async () => {
    const repository = new MemoryRules([rule("existing")]);
    const read = new Gate();
    const retryWrite = new Gate();
    repository.failingCreates.add(1);
    repository.readGates.set(1, read);
    repository.createGates.set(2, retryWrite);
    const { store, errors } = fixture(repository);
    void store.create("BAI", "price_above", new Decimal(120));
    await store.settled();
    const loading = store.load();
    await read.started;
    const retrying = errors.retryCurrent();
    await retryWrite.started;
    read.release();
    retryWrite.release();
    await retrying;
    await loading;
    expect(store.getSnapshot().rules).toHaveLength(2);
    expect(errors.current).toBeNull();
    expect(repository.events.indexOf("create-2-finished")).toBeLessThan(repository.events.indexOf("read-2"));
  });

  it("a reset rejects the old read and write without clearing the new load", async () => {
    const repository = new MemoryRules([rule("old-account")]);
    const firstRead = new Gate();
    const nextRead = new Gate();
    const oldWrite = new Gate();
    repository.readGates.set(1, firstRead);
    repository.readGates.set(2, nextRead);
    repository.createGates.set(1, oldWrite);
    const { store, ids } = fixture(repository);
    const oldLoad = store.load();
    await firstRead.started;
    const oldSave = store.create("BAI", "price_above", new Decimal(120));
    await oldWrite.started;
    store.reset();
    const nextLoad = store.load();
    await nextRead.started;
    firstRead.release();
    await oldLoad;
    expect(store.getSnapshot().status).toBe("loading");
    expect(ids()).toEqual([]);
    oldWrite.release();
    expect(await oldSave).toBe(false);
    // The old account's write reached its own rows; the next account reads only its own.
    repository.rows = new Map([["next-account", rule("next-account")]]);
    nextRead.release();
    await nextLoad;
    expect(ids()).toEqual(["next-account"]);
    expect(repository.reads).toBe(2);
  });

  it("an aborted read overtaken by a write neither reloads nor reports", async () => {
    const repository = new MemoryRules([rule("existing")]);
    const read = new Gate();
    repository.readGates.set(1, read);
    const { store, errors } = fixture(repository);
    const controller = new AbortController();
    const loading = store.load(controller.signal);
    await read.started;
    void store.create("BAI", "price_above", new Decimal(120));
    await store.settled();
    controller.abort();
    read.release();
    await loading;
    expect(store.getSnapshot().status).toBe("idle");
    expect(errors.current).toBeNull();
    expect(repository.reads).toBe(1);
  });
});
