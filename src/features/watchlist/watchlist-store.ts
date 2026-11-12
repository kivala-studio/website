import type { SubscriptionAccess } from "@/domain/account/access";
import type { MovementSensitivity } from "@/domain/account/alerts";
import type { WatchlistDocument, WatchlistGroup, WatchlistReceipt } from "@/domain/account/watchlist";
import { merging, persistableOrder, reordered, restorePosition } from "@/domain/account/watchlist-ordering";
import { CancellationError, type ErrorCoordinator, type UpgradeReason, isCancellation, mapError } from "@/domain/errors";

/** The server refused a reorder because membership changed elsewhere (`22023`): reload, then let the user retry. */
export class WatchlistChangedError extends Error {
  override readonly name = "WatchlistChangedError";
}

/** Every write the list makes (contract §4.1–4.2, §4.5). Each call is idempotent where the contract allows. */
export interface WatchlistRepository {
  read(): Promise<WatchlistDocument>;
  /** Inserts one row at the end; an existing row is not an error. */
  add(id: string): Promise<void>;
  /** Deletes one row and returns it, or null when there was none. */
  remove(id: string): Promise<WatchlistReceipt | null>;
  /** Re-inserts exactly the deleted row; a newer row for the same instrument makes it fail. */
  restore(receipt: WatchlistReceipt): Promise<void>;
  /** `reorder_watchlist`; throws `WatchlistChangedError` when the membership no longer matches. */
  reorder(ids: readonly string[]): Promise<void>;
  setAutomatic(id: string, enabled: boolean): Promise<void>;
  createGroup(id: string, name: string): Promise<void>;
  renameGroup(id: string, name: string): Promise<void>;
  deleteGroup(id: string): Promise<void>;
  setGroupMember(groupID: string, securityID: string, member: boolean): Promise<void>;
  /** `select_free_watchlist`; returns the new access document. */
  selectFree(ids: readonly string[], movementID: string | null): Promise<SubscriptionAccess | null>;
  setSensitivity(value: MovementSensitivity): Promise<void>;
}

export type WatchlistStatus = "idle" | "loading" | "loaded" | "failed";

export type UndoHandle = { readonly id: number; readonly securityID: string };

export interface WatchlistSnapshot {
  /** Of the full document (flags, groups); membership is known from the start. */
  readonly status: WatchlistStatus;
  /** Watched ids in list order, including unconfirmed changes. */
  readonly order: readonly string[];
  readonly automatic: ReadonlyMap<string, boolean>;
  readonly groups: readonly WatchlistGroup[];
  readonly sensitivity: MovementSensitivity;
  /** The removal the undo bar offers, until another change or the account changes. */
  readonly undo: UndoHandle | null;
  /** Operation keys being saved (`watchlist.<id>`, `automatic.<id>`, `group.<id>`). */
  readonly pending: ReadonlySet<string>;
}

export interface WatchlistEvents {
  /** A plan limit refused a write; `retry` repeats the same save (after an upgrade). */
  upgrade(reason: UpgradeReason, retry: () => Promise<void>): void;
  /** Confirmed membership or movement flags changed: the server's access document may differ now. */
  accessChanged(access?: SubscriptionAccess | null): void;
}

type Pending = { handle: UndoHandle; account: number; previousOrder: string[]; receipt: WatchlistReceipt | null; requested: boolean };

type Mutation = {
  key: string;
  operation: () => Promise<void>;
  confirm: () => void;
  restore: () => void;
  commit: () => void;
};

const NOOP = () => {};

/**
 * The account's watchlist (iOS `MarketStore` watchlist half): optimistic changes saved one at a time in
 * order, each rolled back on failure with one retryable toast. A read waits for queued writes and is
 * repeated when a write joined meanwhile, so it never resurrects or drops a change. `reset` (account
 * change) invalidates everything in flight.
 */
export class WatchlistStore {
  private state: WatchlistSnapshot;
  private readonly listeners = new Set<() => void>();
  private tail: Promise<void> = Promise.resolve();
  private loading: Promise<boolean> | null = null;
  private generation = 0;
  private revision = 0;
  private nextVersion = 0;
  private nextHandle = 0;
  private readonly versions = new Map<string, number>();
  private confirmed = new Map<string, boolean>();
  private confirmedOrder: string[];
  private confirmedAutomatic = new Map<string, boolean>();
  private pendingUndo: Pending | null = null;
  /** The last plan refusal's retry (iOS `takeSubscriptionLimitRetry`). */
  private limitRetry: (() => Promise<void>) | null = null;

  constructor(
    private readonly repository: WatchlistRepository,
    private readonly errors: ErrorCoordinator,
    initialOrder: readonly string[],
    private readonly events: Partial<WatchlistEvents> = {},
  ) {
    const order = [...new Set(initialOrder)];
    this.confirmedOrder = order;
    for (const id of order) this.confirmed.set(id, true);
    this.state = { status: "idle", order, automatic: new Map(), groups: [], sensitivity: "normal", undo: null, pending: new Set() };
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.state;

  private set(change: Partial<WatchlistSnapshot>) {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }

  /** Resolves once every queued write has settled. */
  async settled(): Promise<void> {
    let tail: Promise<void>;
    do {
      tail = this.tail;
      await tail;
    } while (tail !== this.tail);
  }

  takeLimitRetry(): (() => Promise<void>) | null {
    const retry = this.limitRetry;
    this.limitRetry = null;
    return retry;
  }

  // MARK: Reading

  /** Reads flags, groups and membership; with `force`, also when already loaded. Returns whether it loaded. */
  async load(force = false): Promise<boolean> {
    const token = this.generation;
    if (this.loading) return (await this.loading) && token === this.generation;
    if (!force && this.state.status === "loaded") return true;
    if (this.state.status !== "loaded") this.set({ status: "loading" });
    const task = this.read(token);
    this.loading = task;
    const loaded = await task;
    if (this.loading === task) this.loading = null;
    return loaded && token === this.generation;
  }

  private async read(token: number): Promise<boolean> {
    while (token === this.generation) {
      const revision = this.revision;
      await this.settled();
      if (token !== this.generation || this.errors.isRetrying) break;
      if (revision !== this.revision) continue;
      let document: WatchlistDocument;
      try {
        document = await this.repository.read();
      } catch (error) {
        if (token !== this.generation) return false;
        // A write joined meanwhile: read the current membership instead of reporting this failure.
        if (revision !== this.revision) continue;
        if (isCancellation(error)) break;
        this.errors.handle(error, "watchlist.load");
        this.set({ status: "failed" });
        return false;
      }
      if (token !== this.generation) return false;
      if (revision !== this.revision) continue;
      this.install(document);
      return true;
    }
    if (token === this.generation && this.state.status === "loading") this.set({ status: "idle" });
    return false;
  }

  private install(document: WatchlistDocument) {
    const order = [...new Set(document.items.map((item) => item.id))];
    this.confirmedOrder = order;
    this.confirmed = new Map(order.map((id) => [id, true]));
    this.confirmedAutomatic = new Map(document.items.map((item) => [item.id, item.automaticAlerts]));
    const watched = new Set(order);
    this.set({
      status: "loaded",
      order,
      automatic: new Map(this.confirmedAutomatic),
      groups: document.groups.map((group) => ({ ...group, members: group.members.filter((id) => watched.has(id)) })),
      sensitivity: document.sensitivity,
    });
    if (document.access) this.events.accessChanged?.(document.access);
  }

  // MARK: Membership

  setWatched(id: string, watched: boolean) {
    this.changeMembership(id, watched);
  }

  /** Removes with an undo bar; null when the instrument is not watched or a retry is running. */
  removeForUndo(id: string): UndoHandle | null {
    if (this.errors.isRetrying || !this.state.order.includes(id)) return null;
    const handle = { id: ++this.nextHandle, securityID: id };
    this.changeMembership(id, false, handle);
    return handle;
  }

  canUndo(handle: UndoHandle): boolean {
    const pending = this.pendingUndo;
    return pending?.handle === handle && pending.account === this.generation && !pending.requested;
  }

  discardUndo(handle: UndoHandle) {
    if (this.pendingUndo?.handle === handle) this.invalidateUndo();
  }

  undo(handle: UndoHandle) {
    if (this.errors.isRetrying || !this.canUndo(handle)) return;
    this.pendingUndo = { ...this.pendingUndo!, requested: true };
    this.set({ undo: null });
    const token = this.generation;
    const commit: { pending: Pending | null; membership?: number; order?: number } = { pending: null };
    this.persist({
      key: "watchlist.undo",
      operation: async () => {
        const pending = this.pendingUndo;
        if (token !== this.generation || pending?.handle !== handle || !pending.receipt) throw new CancellationError();
        commit.pending = pending;
        commit.membership = this.versions.get(`watchlist.${handle.securityID}`);
        commit.order = this.versions.get("watchlist.order");
        await this.repository.restore(pending.receipt);
        // Once the insert went through, its effect is confirmed even if a newer action invalidated the undo.
        if (token !== this.generation) throw new CancellationError();
      },
      confirm: () => this.confirmUndo(commit),
      // The removed row stays absent until its restoration is confirmed.
      restore: NOOP,
      commit: NOOP,
    });
  }

  private changeMembership(id: string, watched: boolean, handle?: UndoHandle) {
    if (this.errors.isRetrying) return;
    this.invalidateUndo();
    const previousOrder = this.state.order;
    if (handle) {
      this.pendingUndo = { handle, account: this.generation, previousOrder: this.confirmedOrder, receipt: null, requested: false };
    }
    this.apply(id, watched);
    if (handle) this.set({ undo: handle });
    this.persist({
      key: `watchlist.${id}`,
      operation: async () => {
        if (!handle) return watched ? this.repository.add(id) : void (await this.repository.remove(id));
        // Earlier queued writes may have changed the confirmed order.
        if (this.pendingUndo?.handle === handle) this.pendingUndo = { ...this.pendingUndo, previousOrder: this.confirmedOrder };
        const receipt = await this.repository.remove(id);
        if (this.pendingUndo?.handle === handle && this.pendingUndo.account === this.generation) {
          this.pendingUndo = { ...this.pendingUndo, receipt };
          if (!receipt) this.invalidateUndo();
        }
      },
      confirm: () => {
        const changed = (this.confirmed.get(id) ?? false) !== watched;
        this.confirmed.set(id, watched);
        // The visible order may hold an unconfirmed reorder: only this membership changes.
        if (watched) {
          if (!this.confirmedOrder.includes(id)) this.confirmedOrder = [...this.confirmedOrder, id];
        } else {
          this.confirmedOrder = this.confirmedOrder.filter((item) => item !== id);
          this.confirmedAutomatic.delete(id);
          // The server removed its group memberships with the row.
          this.set({ groups: this.state.groups.map((group) => ({ ...group, members: group.members.filter((member) => member !== id) })) });
        }
        if (changed) this.events.accessChanged?.();
      },
      restore: () => {
        if (handle && this.pendingUndo?.handle === handle) this.invalidateUndo();
        const previous = this.confirmed.get(id) ?? false;
        this.apply(id, previous);
        if (previous && previousOrder.includes(id)) {
          const order = this.state.order.filter((item) => item !== id);
          order.splice(Math.min(previousOrder.indexOf(id), order.length), 0, id);
          this.set({ order });
        }
      },
      commit: () => this.apply(id, watched),
    });
  }

  private apply(id: string, watched: boolean) {
    const has = this.state.order.includes(id);
    if (watched && !has) {
      this.set({ order: [...this.state.order, id], automatic: withFlag(this.state.automatic, id, this.confirmedAutomatic.get(id) ?? true) });
    } else if (!watched && has) {
      this.set({ order: this.state.order.filter((item) => item !== id) });
    }
  }

  private confirmUndo(commit: { pending: Pending | null; membership?: number; order?: number }) {
    const pending = commit.pending;
    if (!pending || pending.account !== this.generation || !pending.receipt) return;
    const id = pending.handle.securityID;
    const changed = this.confirmed.get(id) !== true;
    this.confirmed.set(id, true);
    this.confirmedOrder = restorePosition(id, pending.previousOrder, this.confirmedOrder);
    this.confirmedAutomatic.set(id, pending.receipt.automaticAlertsEnabled);
    // Newer optimistic membership or order wins over this completed write.
    if (this.versions.get(`watchlist.${id}`) === commit.membership) {
      this.apply(id, true);
      this.set({ automatic: withFlag(this.state.automatic, id, pending.receipt.automaticAlertsEnabled) });
      if (this.versions.get("watchlist.order") === commit.order) this.set({ order: restorePosition(id, pending.previousOrder, this.state.order) });
    }
    if (changed) this.events.accessChanged?.();
    if (this.pendingUndo?.handle === pending.handle) this.pendingUndo = null;
  }

  private invalidateUndo() {
    this.pendingUndo = null;
    this.versions.delete("watchlist.undo");
    this.errors.resolve("watchlist.undo");
    if (this.state.undo) this.set({ undo: null });
  }

  // MARK: Order

  /** Saves a new order of the visible list; ids it omits keep their place at the end. */
  setOrder(ids: readonly string[]) {
    if (this.errors.isRetrying) return;
    this.invalidateUndo();
    // Saved even when the visible order is unchanged: an undo in flight may still add a row to it.
    const order = reordered(ids, this.state.order, new Set(this.state.order));
    this.set({ order });
    const commit = { order: [] as string[], version: 0 };
    commit.version = this.persist({
      key: "watchlist.order",
      operation: async () => {
        // An undo in flight can restore membership after this order was chosen.
        commit.order = persistableOrder(order, this.confirmedOrder, this.confirmed);
        if (commit.order.length > 0) await this.repository.reorder(commit.order);
      },
      confirm: () => {
        this.confirmedOrder = commit.order;
        if (this.versions.get("watchlist.order") !== commit.version) return;
        const visible = new Set(this.state.order);
        const flags = new Map([...this.confirmed.keys(), ...visible].map((id) => [id, visible.has(id)]));
        this.set({ order: merging(commit.order, this.state.order, flags) });
      },
      restore: () => this.set({ order: [...this.confirmedOrder] }),
      commit: NOOP,
    });
  }

  // MARK: Automatic movements

  setAutomatic(id: string, enabled: boolean) {
    if (this.errors.isRetrying || !this.state.order.includes(id)) return;
    this.set({ automatic: withFlag(this.state.automatic, id, enabled) });
    this.persist({
      key: `automatic.${id}`,
      operation: () => this.repository.setAutomatic(id, enabled),
      confirm: () => {
        this.confirmedAutomatic.set(id, enabled);
        this.events.accessChanged?.();
      },
      restore: () => this.set({ automatic: withFlag(this.state.automatic, id, this.confirmedAutomatic.get(id) ?? !enabled) }),
      commit: () => this.set({ automatic: withFlag(this.state.automatic, id, enabled) }),
    });
  }

  setSensitivity(value: MovementSensitivity) {
    if (this.errors.isRetrying || value === this.state.sensitivity) return;
    const previous = this.state.sensitivity;
    this.set({ sensitivity: value });
    this.persist({
      key: "movement.sensitivity",
      operation: () => this.repository.setSensitivity(value),
      confirm: NOOP,
      restore: () => this.set({ sensitivity: previous }),
      commit: () => this.set({ sensitivity: value }),
    });
  }

  // MARK: Groups

  /** Creates a group (Plus), optionally with a first member; returns its id. */
  createGroup(name: string, member?: string): string | null {
    if (this.errors.isRetrying) return null;
    const id = crypto.randomUUID();
    const group: WatchlistGroup = { id, name, createdAt: Date.now(), members: member ? [member] : [] };
    this.set({ groups: [...this.state.groups, group] });
    this.persist({
      key: `group.${id}`,
      operation: async () => {
        await this.repository.createGroup(id, name);
        if (member) await this.repository.setGroupMember(id, member, true);
      },
      confirm: NOOP,
      restore: () => this.set({ groups: this.state.groups.filter((item) => item.id !== id) }),
      commit: () => this.set({ groups: [...this.state.groups.filter((item) => item.id !== id), group] }),
    });
    return id;
  }

  renameGroup(id: string, name: string) {
    const previous = this.state.groups.find((group) => group.id === id);
    if (this.errors.isRetrying || !previous || previous.name === name) return;
    this.replaceGroup(id, (group) => ({ ...group, name }));
    this.persist({
      key: `group.${id}`,
      operation: () => this.repository.renameGroup(id, name),
      confirm: NOOP,
      restore: () => this.replaceGroup(id, (group) => ({ ...group, name: previous.name })),
      commit: () => this.replaceGroup(id, (group) => ({ ...group, name })),
    });
  }

  deleteGroup(id: string) {
    const previous = this.state.groups.find((group) => group.id === id);
    if (this.errors.isRetrying || !previous) return;
    this.set({ groups: this.state.groups.filter((group) => group.id !== id) });
    this.persist({
      key: `group.${id}`,
      operation: () => this.repository.deleteGroup(id),
      confirm: NOOP,
      restore: () => this.set({ groups: [...this.state.groups.filter((group) => group.id !== id), previous].sort((a, b) => a.createdAt - b.createdAt) }),
      commit: () => this.set({ groups: this.state.groups.filter((group) => group.id !== id) }),
    });
  }

  setGroupMember(groupID: string, securityID: string, member: boolean) {
    const group = this.state.groups.find((item) => item.id === groupID);
    if (this.errors.isRetrying || !group || group.members.includes(securityID) === member) return;
    const toggle = (value: boolean) => (item: WatchlistGroup) => ({
      ...item,
      members: value ? [...item.members.filter((id) => id !== securityID), securityID] : item.members.filter((id) => id !== securityID),
    });
    this.replaceGroup(groupID, toggle(member));
    this.persist({
      key: `group.${groupID}.${securityID}`,
      operation: () => this.repository.setGroupMember(groupID, securityID, member),
      confirm: NOOP,
      restore: () => this.replaceGroup(groupID, toggle(!member)),
      commit: () => this.replaceGroup(groupID, toggle(member)),
    });
  }

  private replaceGroup(id: string, change: (group: WatchlistGroup) => WatchlistGroup) {
    this.set({ groups: this.state.groups.map((group) => (group.id === id ? change(group) : group)) });
  }

  // MARK: Free plan

  /** `select_free_watchlist` after the queued writes; reloads the list (its order changes). Throws on failure. */
  async selectFree(ids: readonly string[], movementID: string | null): Promise<void> {
    const token = this.generation;
    this.invalidateUndo();
    this.revision += 1;
    const previous = this.tail;
    const run = (async () => {
      await previous;
      if (token !== this.generation) throw new CancellationError();
      return this.repository.selectFree(ids, movementID);
    })();
    this.tail = run.then(NOOP, NOOP);
    const access = await run;
    if (token !== this.generation) return;
    this.events.accessChanged?.(access);
    await this.load(true);
  }

  // MARK: Account

  /** The account changed or signed out: nothing in flight may apply any more. */
  reset(order: readonly string[] = []) {
    this.generation += 1;
    this.revision += 1;
    this.versions.clear();
    this.pendingUndo = null;
    this.limitRetry = null;
    this.loading = null;
    this.tail = Promise.resolve();
    const ids = [...new Set(order)];
    this.confirmedOrder = ids;
    this.confirmed = new Map(ids.map((id) => [id, true]));
    this.confirmedAutomatic = new Map();
    this.errors.resolve("watchlist.undo");
    this.set({ status: "idle", order: ids, automatic: new Map(), groups: [], sensitivity: "normal", undo: null, pending: new Set() });
  }

  // MARK: Queue

  private persist({ key, operation, confirm, restore, commit }: Mutation): number {
    this.revision += 1;
    const version = ++this.nextVersion;
    const token = this.generation;
    this.versions.set(key, version);
    this.errors.resolve(key);
    this.set({ pending: new Set([...this.state.pending, key]) });
    const previous = this.tail;
    const run = async () => {
      await previous;
      if (token !== this.generation) return;
      try {
        await operation();
        if (token !== this.generation) return;
        confirm();
      } catch (error) {
        if (isCancellation(error) || token !== this.generation || this.versions.get(key) !== version) return;
        restore();
        this.fail(error, { key, operation, confirm, restore, commit }, token, version);
      } finally {
        if (token === this.generation && this.versions.get(key) === version) {
          const pending = new Set(this.state.pending);
          pending.delete(key);
          this.set({ pending });
        }
      }
    };
    this.tail = run();
    return version;
  }

  private fail(error: unknown, mutation: Mutation, token: number, version: number) {
    const { key, operation, confirm, commit } = mutation;
    const current = () => token === this.generation && this.versions.get(key) === version;
    if (error instanceof WatchlistChangedError) {
      void this.load(true);
      return;
    }
    const mapped = mapError(error, key);
    if (!mapped) return;
    const upgrade = mapped.rule?.upgrade;
    if (upgrade) {
      // The plan dialog replaces the toast; the same save runs again after an upgrade.
      const retry = async () => {
        if (!current()) return;
        this.persist({ ...mutation, confirm: () => (confirm(), commit()) });
        await this.settled();
      };
      this.limitRetry = retry;
      this.events.upgrade?.(upgrade.reason, retry);
      return;
    }
    this.errors.present(mapped, key, {
      retry: async () => {
        if (!current()) return;
        const previous = this.tail;
        const run = (async () => {
          await previous;
          if (!current()) return;
          this.revision += 1;
          await operation();
          if (!current()) return;
          confirm();
          commit();
        })();
        this.tail = run.then(NOOP, NOOP);
        await run;
      },
    });
  }
}

function withFlag(flags: ReadonlyMap<string, boolean>, id: string, value: boolean): ReadonlyMap<string, boolean> {
  const next = new Map(flags);
  next.set(id, value);
  return next;
}
