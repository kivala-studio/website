import Decimal from "decimal.js";

import { type AlertKind, type AlertRule, acceptsThreshold, newestFirst } from "@/domain/account/alerts";
import { AppError, CancellationError, type ErrorCoordinator, type UpgradeReason, isCancellation, mapError } from "@/domain/errors";

/** `notification_rules` writes (contract §4.3). `create` ignores a row that already has its id. */
export interface AlertRepository {
  read(signal?: AbortSignal): Promise<AlertRule[]>;
  create(rule: AlertRule): Promise<void>;
  update(rule: AlertRule): Promise<void>;
  delete(id: string): Promise<void>;
}

export type AlertsStatus = "idle" | "loading" | "loaded" | "failed";

export interface AlertsSnapshot {
  readonly status: AlertsStatus;
  /** Newest first, including unconfirmed changes. */
  readonly rules: readonly AlertRule[];
  readonly pending: ReadonlySet<string>;
}

type Mutation = { key: string; operation: () => Promise<void>; restore: () => void; commit: () => void; done?: (saved: boolean) => void };

const NOOP = () => {};

/**
 * The account's alert rules (iOS `MarketAlertsStore`, without the inbox): optimistic writes saved one at a
 * time in order, each rolled back with one retryable toast. A read waits for queued writes and is repeated
 * when a write joined meanwhile; `reset` (account change) invalidates everything in flight.
 */
export class AlertsStore {
  private state: AlertsSnapshot = { status: "idle", rules: [], pending: new Set() };
  private readonly listeners = new Set<() => void>();
  private tail: Promise<void> = Promise.resolve();
  private loading: Promise<void> | null = null;
  private generation = 0;
  private revision = 0;
  private nextVersion = 0;
  private readonly versions = new Map<string, number>();

  constructor(
    private readonly repository: AlertRepository,
    private readonly errors: ErrorCoordinator,
    private readonly onUpgrade: (reason: UpgradeReason, retry: () => Promise<void>) => void = NOOP,
  ) {}

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.state;

  private set(change: Partial<AlertsSnapshot>) {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }

  async settled(): Promise<void> {
    let tail: Promise<void>;
    do {
      tail = this.tail;
      await tail;
    } while (tail !== this.tail);
  }

  rulesFor(securityID: string): AlertRule[] {
    return this.state.rules.filter((rule) => rule.securityID === securityID);
  }

  /** Reads every rule once per account; `force` reads again. An aborted read changes nothing. */
  load(signal?: AbortSignal, force = false): Promise<void> {
    if (this.loading) return this.loading;
    if (!force && this.state.status === "loaded") return Promise.resolve();
    const task = this.read(this.generation, signal).finally(() => {
      if (this.loading === task) this.loading = null;
    });
    this.loading = task;
    return task;
  }

  private async read(token: number, signal?: AbortSignal) {
    if (this.errors.isRetrying) return;
    if (this.state.status !== "loaded") this.set({ status: "loading" });
    const stop = () => {
      if (token === this.generation && this.state.status === "loading") this.set({ status: "idle" });
    };
    while (token === this.generation && !signal?.aborted) {
      const revision = this.revision;
      await this.settled();
      if (token !== this.generation) return;
      if (signal?.aborted) return stop();
      if (revision !== this.revision) continue;
      try {
        const rules = await this.repository.read(signal);
        if (token !== this.generation) return;
        if (signal?.aborted) return stop();
        // Replace an overtaken read only after every newer write settled.
        if (revision !== this.revision) continue;
        this.set({ status: "loaded", rules: [...rules].sort(newestFirst) });
        return;
      } catch (error) {
        if (token !== this.generation) return;
        if (signal?.aborted || isCancellation(error)) return stop();
        if (revision !== this.revision) continue;
        this.errors.handle(error, "alerts.load");
        this.set({ status: "failed" });
        return;
      }
    }
    stop();
  }

  /** Creates an enabled rule; resolves with whether it was saved. False at once for an invalid threshold. */
  create(securityID: string, kind: AlertKind, threshold: Decimal): Promise<boolean> {
    if (this.errors.isRetrying) return Promise.resolve(false);
    if (!acceptsThreshold(kind, threshold)) {
      this.errors.present(new AppError("validation", { operation: "alert.create" }), "alert.create");
      return Promise.resolve(false);
    }
    const rule: AlertRule = { id: crypto.randomUUID(), securityID, kind, threshold, isEnabled: true, createdAt: Date.now() };
    this.set({ rules: [rule, ...this.state.rules] });
    return new Promise((done) =>
      this.persist({
        key: `alert.${rule.id}`,
        operation: () => this.repository.create(rule),
        restore: () => this.set({ rules: this.state.rules.filter((item) => item.id !== rule.id) }),
        commit: () => this.replace(rule),
        done,
      }),
    );
  }

  update(rule: AlertRule): Promise<boolean> {
    const key = `alert.${rule.id}`;
    const previous = this.state.rules.find((item) => item.id === rule.id);
    if (this.errors.isRetrying || this.state.pending.has(key) || !previous) return Promise.resolve(false);
    if (!acceptsThreshold(rule.kind, rule.threshold)) {
      this.errors.present(new AppError("validation", { operation: "alert.update" }), "alert.update");
      return Promise.resolve(false);
    }
    this.replace(rule);
    return new Promise((done) =>
      this.persist({ key, operation: () => this.repository.update(rule), restore: () => this.replace(previous), commit: () => this.replace(rule), done }),
    );
  }

  setEnabled(id: string, isEnabled: boolean) {
    const rule = this.state.rules.find((item) => item.id === id);
    if (rule && rule.isEnabled !== isEnabled) void this.update({ ...rule, isEnabled });
  }

  delete(id: string) {
    const key = `alert.${id}`;
    const previous = this.state.rules.find((item) => item.id === id);
    if (this.errors.isRetrying || this.state.pending.has(key) || !previous) return;
    const without = () => this.set({ rules: this.state.rules.filter((item) => item.id !== id) });
    without();
    this.persist({ key, operation: () => this.repository.delete(id), restore: () => this.replace(previous), commit: without });
  }

  reset() {
    this.generation += 1;
    this.revision += 1;
    this.versions.clear();
    this.loading = null;
    this.tail = Promise.resolve();
    this.set({ status: "idle", rules: [], pending: new Set() });
  }

  private replace(rule: AlertRule) {
    this.set({ rules: [...this.state.rules.filter((item) => item.id !== rule.id), rule].sort(newestFirst) });
  }

  private setPending(key: string, on: boolean) {
    const pending = new Set(this.state.pending);
    if (on) pending.add(key);
    else pending.delete(key);
    this.set({ pending });
  }

  private persist(mutation: Mutation) {
    const { key, operation, restore, done } = mutation;
    this.revision += 1;
    const version = ++this.nextVersion;
    const token = this.generation;
    this.versions.set(key, version);
    this.errors.resolve(key);
    this.setPending(key, true);
    const current = () => token === this.generation && this.versions.get(key) === version;
    const previous = this.tail;
    const run = async () => {
      await previous;
      try {
        if (token !== this.generation) return done?.(false);
        await operation();
        done?.(current());
      } catch (error) {
        if (!current() || isCancellation(error)) return done?.(false);
        restore();
        done?.(false);
        this.fail(error, mutation, current);
      } finally {
        if (current()) this.setPending(key, false);
      }
    };
    this.tail = run();
  }

  private fail(error: unknown, { key, operation, commit }: Mutation, current: () => boolean) {
    const mapped = mapError(error, key);
    if (!mapped) return;
    const retry = async () => {
      if (!current()) return;
      const previous = this.tail;
      this.revision += 1;
      this.setPending(key, true);
      const run = (async () => {
        try {
          await previous;
          if (!current()) throw new CancellationError();
          await operation();
          if (!current()) throw new CancellationError();
          commit();
        } finally {
          if (current()) this.setPending(key, false);
        }
      })();
      this.tail = run.then(NOOP, NOOP);
      await run;
    };
    const upgrade = mapped.rule?.upgrade;
    if (upgrade) return this.onUpgrade(upgrade.reason, retry);
    this.errors.present(mapped, key, { retry });
  }
}
