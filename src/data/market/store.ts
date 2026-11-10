import { type AppError, CancellationError, ErrorCoordinator, isCancellation, mapError, retryAfterSeconds } from "@/domain/errors";
import {
  INITIAL_REFRESH_STATE,
  type MarketCalendar,
  type MarketDataAvailability,
  type MarketSnapshot,
  type RefreshState,
  acceptsAnnouncement,
  applyCurrentQuotePolicy,
  automaticRefreshDecision,
  baseRefreshInterval,
  controlledInterval,
  dataAvailability,
  nextAutomaticWait,
  nextReassessment,
  recordReconnect,
  recordRefreshFailure,
  recordRefreshSuccess,
  revokeCurrentQuotes,
} from "@/domain/market";
import { type EpochMs, SECOND_MS } from "@/domain/market/zone";

import type { MarketRepository } from "./repository";

export type MarketLoadState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "loaded"; readonly snapshot: MarketSnapshot }
  | { readonly kind: "failed"; readonly error: AppError };

export interface MarketStoreState {
  readonly load: MarketLoadState;
  readonly calendar?: MarketCalendar;
  /** When the loaded snapshot was last assessed; views evaluate display rules at this instant. */
  readonly assessedAt?: EpochMs;
  readonly isRefreshing: boolean;
  /** The last refresh of loaded content failed; its current quotes are revoked. */
  readonly refreshError: AppError | null;
  readonly isOffline: boolean;
  /** Hidden tab: no polling, no announcements, nothing current. */
  readonly isSuspended: boolean;
  readonly hasLoadedLiveSnapshot: boolean;
  readonly isReceivingLiveQuotes: boolean;
  readonly refresh: RefreshState;
}

export type Sleep = (ms: number, signal: AbortSignal) => Promise<void>;

export interface MarketStoreOptions {
  repository: MarketRepository;
  errors?: ErrorCoordinator;
  now?: () => EpochMs;
  /** [0, 1): backoff and announcement jitter. */
  random?: () => number;
  /** Poll and announcement waits; rejects when the signal aborts. */
  sleep?: Sleep;
  initialState?: MarketLoadState;
}

const LOAD = "market.load";
/** An announcement within this long of a load attempt is already covered by it. */
const ANNOUNCEMENT_QUIET_MS = 5 * SECOND_MS;
/** Longest wait `setTimeout` accepts. */
const MAX_TIMER_MS = 2 ** 31 - 1;

const defaultSleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new CancellationError());
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new CancellationError());
      },
      { once: true },
    );
  });

/** The shared task's result for one caller; that caller's abort ends only its own wait, with `false`. */
function untilAborted(task: Promise<boolean>, signal: AbortSignal | undefined): Promise<boolean> {
  if (!signal) return task;
  return new Promise((resolve) => {
    const abandon = () => resolve(false);
    signal.addEventListener("abort", abandon, { once: true });
    void task.then((result) => {
      signal.removeEventListener("abort", abandon);
      resolve(result && !signal.aborted);
    });
  });
}

/**
 * The tab's single owner of market state (iOS `MarketStore`, quote part). Every result is applied
 * only if no suspension or reset happened since its request started; concurrent loads share one
 * request; a caller's abort ends only its own wait. Current quotes are revoked when the tab is
 * hidden, the connection is lost or a refresh fails, and downgraded locally at their deadlines.
 * Only `runAutomaticRefresh` retries, with backoff.
 */
export class MarketStore {
  readonly errors: ErrorCoordinator;
  private state: MarketStoreState;
  private readonly listeners = new Set<() => void>();
  private readonly repository: MarketRepository;
  private readonly now: () => EpochMs;
  private readonly random: () => number;
  private readonly sleep: Sleep;
  private generation = 0;
  private lifecycle = new AbortController();
  private loadTask: Promise<boolean> | undefined;
  private loadRequest = 0;
  private activeRequest: number | undefined;
  private lastLoadAttemptAt: EpochMs | undefined;
  private indexLoaded = false;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  private loopGeneration: number | undefined;

  constructor(options: MarketStoreOptions) {
    this.repository = options.repository;
    this.errors = options.errors ?? new ErrorCoordinator();
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.sleep = options.sleep ?? defaultSleep;
    this.state = {
      load: options.initialState ?? { kind: "idle" },
      isRefreshing: false,
      refreshError: null,
      isOffline: false,
      isSuspended: false,
      hasLoadedLiveSnapshot: false,
      isReceivingLiveQuotes: false,
      refresh: INITIAL_REFRESH_STATE,
    };
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): MarketStoreState => this.state;

  get snapshot(): MarketSnapshot | undefined {
    return this.state.load.kind === "loaded" ? this.state.load.snapshot : undefined;
  }

  /** Changes on every suspension or reset; results started before it are discarded. */
  get foregroundGeneration(): number {
    return this.generation;
  }

  get isInMaintenance(): boolean {
    return this.repository.clientControl()?.maintenance === true;
  }

  dataAvailability(): MarketDataAvailability | undefined {
    const snapshot = this.snapshot;
    if (!snapshot) return undefined;
    const isOffline = this.state.isOffline || this.state.refreshError?.category === "offline";
    return dataAvailability(snapshot, this.now(), { isOffline });
  }

  /** Seconds between automatic refreshes after server control. */
  refreshInterval(): number {
    const base = baseRefreshInterval(this.snapshot?.status, this.state.isReceivingLiveQuotes);
    return controlledInterval(base, this.repository.clientControl());
  }

  setLiveFeed(connected: boolean): void {
    if (this.state.isReceivingLiveQuotes !== connected) this.patch({ isReceivingLiveQuotes: connected });
  }

  /** Losing the connection revokes current quotes; reconnecting makes the next tick fetch. */
  setConnectivity(offline: boolean): void {
    const reconnecting = this.state.isOffline && !offline;
    this.patch({ isOffline: offline, refresh: reconnecting ? recordReconnect(this.state.refresh) : this.state.refresh });
    if (offline) this.reassessCurrentQuotes();
  }

  /** Re-evaluates loaded quotes against the calendar and clock without a request. */
  reassessCurrentQuotes(): void {
    const snapshot = this.snapshot;
    if (!snapshot) return;
    const now = this.now();
    const permits = !this.state.isOffline && !this.state.isSuspended;
    this.install(applyCurrentQuotePolicy(snapshot, this.state.calendar, now, permits));
  }

  /**
   * Leaving the page or hiding the tab: in-flight results are discarded and polling stops. With
   * `preservingContent` the loaded snapshot stays as dated evidence with every current quote revoked.
   */
  suspend({ preservingContent = false }: { preservingContent?: boolean } = {}): void {
    if (this.state.isSuspended) return;
    this.invalidate();
    const snapshot = this.snapshot;
    const refresh = { ...this.state.refresh, lastSuccessAt: undefined };
    if (preservingContent && this.state.hasLoadedLiveSnapshot && snapshot) {
      this.patch({
        isSuspended: true,
        isRefreshing: false,
        refresh,
        load: { kind: "loaded", snapshot: revokeCurrentQuotes(snapshot, this.state.calendar, this.now()) },
      });
      return;
    }
    this.indexLoaded = false;
    this.patch({
      isSuspended: true,
      isRefreshing: false,
      hasLoadedLiveSnapshot: false,
      calendar: undefined,
      refresh,
      load: { kind: "idle" },
    });
  }

  /** Sign-out or teardown: forgets everything and invalidates every pending result. */
  reset(): void {
    this.invalidate();
    this.indexLoaded = false;
    this.lastLoadAttemptAt = undefined;
    this.state = {
      ...this.state,
      load: { kind: "idle" },
      calendar: undefined,
      isRefreshing: false,
      refreshError: null,
      isSuspended: false,
      hasLoadedLiveSnapshot: false,
      refresh: INITIAL_REFRESH_STATE,
    };
    this.emit();
  }

  /**
   * Loads quotes; joins a load already in flight. Without `force` a loaded snapshot is kept.
   * `signal` ends only this caller's wait, never the shared request.
   */
  async load({ force = false, signal }: { force?: boolean; signal?: AbortSignal } = {}): Promise<boolean> {
    if (signal?.aborted) return false;
    if (this.loadTask) return untilAborted(this.loadTask, signal);
    if (!force && this.state.hasLoadedLiveSnapshot && this.state.load.kind === "loaded") return true;
    if (this.errors.isRetrying) return false;
    if (this.state.isSuspended) this.patch({ isSuspended: false });
    const request = ++this.loadRequest;
    this.activeRequest = request;
    const task: Promise<boolean> = this.performLoad(this.generation, request).finally(() => {
      if (this.loadTask === task) this.loadTask = undefined;
    });
    this.loadTask = task;
    return untilAborted(task, signal);
  }

  /** One automatic tick: reassess, then fetch unless fresh or backing off. */
  async refreshIfNeeded(): Promise<boolean> {
    this.reassessCurrentQuotes();
    const decision = automaticRefreshDecision({
      state: this.state.refresh,
      now: this.now(),
      interval: this.refreshInterval(),
      hidden: false,
      offline: this.state.isOffline,
      snapshot: this.snapshot,
    });
    if (decision === "backoff") return false;
    if (decision === "fresh") return true;
    return this.load({ force: true });
  }

  /**
   * The poll loop: the only place requests repeat. One loop per visible period; it ends when the
   * store is suspended or reset.
   */
  async runAutomaticRefresh(): Promise<void> {
    const token = this.generation;
    if (this.loopGeneration === token) return;
    this.loopGeneration = token;
    const signal = this.lifecycle.signal;
    while (token === this.generation) {
      await this.refreshIfNeeded();
      if (token !== this.generation) return;
      try {
        await this.sleep(nextAutomaticWait(this.state.refresh, this.now(), this.refreshInterval()), signal);
      } catch {
        return;
      }
    }
  }

  /**
   * Realtime announced a new snapshot. It carries no prices: it only triggers one reload after a
   * random wait of up to ten seconds, unless the snapshot is already held, a load just started,
   * failures are backing off or the server is in maintenance.
   */
  async applyQuoteAnnouncement({ generatedAt, etag }: { generatedAt?: EpochMs; etag?: string }): Promise<void> {
    const { isSuspended, hasLoadedLiveSnapshot, refresh } = this.state;
    if (isSuspended || !hasLoadedLiveSnapshot) return;
    const now = this.now();
    if (!acceptsAnnouncement({ state: refresh, now, control: this.repository.clientControl() })) return;
    if (this.lastLoadAttemptAt !== undefined && now - this.lastLoadAttemptAt < ANNOUNCEMENT_QUIET_MS) return;
    const metadata = this.snapshot?.sourceMetadata;
    if (etag !== undefined && etag === metadata?.snapshotETag) return;
    const loaded = metadata?.snapshotGeneratedAt;
    if (generatedAt !== undefined && loaded !== undefined && generatedAt <= loaded) return;
    this.lastLoadAttemptAt = now;
    const token = this.generation;
    try {
      await this.sleep(10 * SECOND_MS * this.random(), this.lifecycle.signal);
    } catch {
      return;
    }
    if (token !== this.generation || this.state.isSuspended) return;
    await this.load({ force: true });
  }

  private async performLoad(token: number, request: number): Promise<boolean> {
    const isCurrent = () => token === this.generation && this.activeRequest === request;
    const signal = this.lifecycle.signal;
    this.lastLoadAttemptAt = this.now();
    const loaded = this.state.hasLoadedLiveSnapshot;
    this.patch({ isRefreshing: loaded, refreshError: null, ...(loaded ? {} : { load: { kind: "loading" } as const }) });
    try {
      const fetched = await this.repository.fetchLightSnapshot(signal);
      if (!isCurrent()) return false;
      // After the snapshot, so a calendar bundled with it answers without a request.
      let calendar = this.state.calendar;
      try {
        calendar = (await this.repository.fetchTradingCalendar(signal)) ?? calendar;
      } catch (error) {
        // A transient calendar failure keeps the verified calendar until its own deadline.
        if (isCancellation(error)) throw error;
      }
      let index = this.snapshot?.index;
      if (!this.indexLoaded) {
        try {
          index = await this.repository.fetchMarketIndex(signal);
          this.indexLoaded = true;
        } catch (error) {
          if (isCancellation(error)) throw error;
        }
      }
      if (!isCurrent()) return false;
      const now = this.now();
      const assessed = applyCurrentQuotePolicy(index ? { ...fetched, index } : fetched, calendar, now);
      this.state = {
        ...this.state,
        calendar,
        hasLoadedLiveSnapshot: true,
        isOffline: false,
        refreshError: null,
        refresh: recordRefreshSuccess(now),
      };
      this.install(assessed);
      return token === this.generation;
    } catch (error) {
      if (!isCurrent()) return false;
      const mapped = mapError(error, LOAD);
      if (!mapped) {
        if (this.state.load.kind === "loading") this.patch({ load: { kind: "idle" } });
        return false;
      }
      this.patch({
        refresh: recordRefreshFailure(this.state.refresh, {
          now: this.now(),
          interval: this.refreshInterval(),
          offline: mapped.category === "offline",
          retryAfter: retryAfterSeconds(mapped) ?? undefined,
          randomUnit: this.random(),
        }),
      });
      const failure = this.errors.handle(mapped, LOAD) ?? mapped;
      const snapshot = this.snapshot;
      if (snapshot) {
        this.state = { ...this.state, refreshError: failure };
        this.install(revokeCurrentQuotes(snapshot, this.state.calendar, this.now()));
      } else {
        this.patch({ load: { kind: "failed", error: failure } });
      }
      return false;
    } finally {
      if (isCurrent() && this.state.isRefreshing) this.patch({ isRefreshing: false });
    }
  }

  private install(snapshot: MarketSnapshot): void {
    this.patch({ load: { kind: "loaded", snapshot }, assessedAt: this.now() });
    this.scheduleExpiry(snapshot);
  }

  /** Downgrades locally at the next quote, book, statistics or calendar deadline. */
  private scheduleExpiry(snapshot: MarketSnapshot): void {
    clearTimeout(this.expiryTimer);
    this.expiryTimer = undefined;
    const now = this.now();
    const deadline = nextReassessment(snapshot, now);
    if (deadline === undefined) return;
    const token = this.generation;
    this.expiryTimer = setTimeout(
      () => {
        this.expiryTimer = undefined;
        if (token === this.generation && this.snapshot === snapshot) this.reassessCurrentQuotes();
      },
      Math.min(deadline - now, MAX_TIMER_MS),
    );
  }

  private invalidate(): void {
    this.generation += 1;
    this.lifecycle.abort();
    this.lifecycle = new AbortController();
    this.loadTask = undefined;
    this.activeRequest = undefined;
    clearTimeout(this.expiryTimer);
    this.expiryTimer = undefined;
  }

  private patch(changes: Partial<MarketStoreState>): void {
    this.state = { ...this.state, ...changes };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
