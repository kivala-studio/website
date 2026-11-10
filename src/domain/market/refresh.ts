import type { MarketClientControl, MarketSnapshot, MarketStatus } from "./models";
import { type EpochMs, SECOND_MS } from "./zone";
import { retryAfterFromBody } from "../errors/map";

/** Seconds. */
export const MAXIMUM_BACKOFF_SECONDS = 300;
/** Automatic cadence while the server reports maintenance; polling still learns when it ends. */
export const MAINTENANCE_INTERVAL_SECONDS = 300;

/**
 * Seconds between automatic quote requests: 30 while open or unknown, 60 while closed or opening
 * soon, 120 while Realtime announcements flow (polling is then only a watchdog).
 */
export function baseRefreshInterval(status: MarketStatus | undefined, liveFeed = false): number {
  if (liveFeed) return 120;
  return status === "closed" || status === "openingSoon" ? 60 : 30;
}

/** The cadence after server control: never below `min_poll_seconds` (clamped 5…3600), slow in maintenance. */
export function controlledInterval(base: number, control: MarketClientControl | undefined): number {
  if (!control) return base;
  const floor = Math.min(Math.max(control.minPollSeconds, 5), 3600);
  return Math.max(base, floor, control.maintenance ? MAINTENANCE_INTERVAL_SECONDS : 0);
}

/**
 * Seconds before the next automatic attempt after `failures` consecutive failures. The first keeps the
 * cadence; later ones back off exponentially with full jitter, capped at five minutes, never below the
 * cadence or the server's `retry_after_seconds`.
 */
export function backoffSeconds(input: { failures: number; base: number; retryAfter?: number; randomUnit: number }): number {
  const { failures, base, retryAfter, randomUnit } = input;
  const floor = Math.min(MAXIMUM_BACKOFF_SECONDS, Math.max(base, retryAfter ?? 0));
  if (failures < 2) return floor;
  const ceiling = Math.min(MAXIMUM_BACKOFF_SECONDS, base * 2 ** (failures - 1));
  return Math.max(floor, ceiling * Math.min(Math.max(randomUnit, 0), 1));
}

/** `retry_after_seconds` from a JSON error body (object or text), when positive. */
export function parseRetryAfterSeconds(body: unknown): number | undefined {
  return retryAfterFromBody(body) ?? undefined;
}

const toMs = (epoch: number | undefined) => (epoch === undefined ? undefined : epoch * SECOND_MS);

const finite = (values: readonly (number | undefined)[]) =>
  values.filter((value): value is number => value !== undefined && Number.isFinite(value));

/** Quote and statistics validity windows of a fetched response. */
function responseDeadlines(snapshot: MarketSnapshot): EpochMs[] {
  return finite([
    ...snapshot.securities.map((security) => toMs(security.quoteQuality?.validUntilEpoch)),
    toMs(snapshot.statisticsQuality?.validUntilEpoch),
    snapshot.marketContextValidUntil,
  ]);
}

/** Whether a deadline carried by a response fetched at `fetchedAt` has passed since: one early refresh. */
export const hasExpiredSinceFetch = (snapshot: MarketSnapshot, fetchedAt: EpochMs, now: EpochMs) =>
  responseDeadlines(snapshot).some((deadline) => deadline > fetchedAt && deadline <= now);

/**
 * Local downgrade deadline: the next instant at which a displayed value (quote, order book, totals or
 * calendar context) must be reassessed, without a network call.
 */
export function nextReassessment(snapshot: MarketSnapshot, now: EpochMs): EpochMs | undefined {
  const deadlines = finite([
    ...snapshot.securities.flatMap((security) => [
      toMs(security.quoteQuality?.validUntilEpoch),
      toMs(security.orderBookQuality?.validUntilEpoch),
      security.marketContextValidUntil,
    ]),
    toMs(snapshot.statisticsQuality?.validUntilEpoch),
    snapshot.marketContextValidUntil,
  ]).filter((deadline) => deadline > now);
  return deadlines.length === 0 ? undefined : Math.min(...deadlines);
}

/** Poll-loop bookkeeping. Explicit refreshes ignore the backoff window; offline failures do not count. */
export interface RefreshState {
  readonly consecutiveFailures: number;
  readonly nextAttemptNotBefore?: EpochMs;
  readonly lastSuccessAt?: EpochMs;
}

export const INITIAL_REFRESH_STATE: RefreshState = { consecutiveFailures: 0 };

export const recordRefreshSuccess = (now: EpochMs): RefreshState => ({ consecutiveFailures: 0, lastSuccessAt: now });

/** The jitter is drawn once per failure, so every wait for that failure agrees. */
export function recordRefreshFailure(
  state: RefreshState,
  failure: { now: EpochMs; interval: number; offline: boolean; retryAfter?: number; randomUnit: number },
): RefreshState {
  if (failure.offline) return state;
  const failures = state.consecutiveFailures + 1;
  const delay = backoffSeconds({ failures, base: failure.interval, retryAfter: failure.retryAfter, randomUnit: failure.randomUnit });
  return { ...state, consecutiveFailures: failures, nextAttemptNotBefore: failure.now + delay * SECOND_MS };
}

/** Coming back online forgets the last success so the next tick fetches. */
export const recordReconnect = (state: RefreshState): RefreshState => ({ ...state, lastSuccessAt: undefined });

export type RefreshDecision = "fetch" | "paused" | "backoff" | "fresh";

/**
 * What an automatic tick should do. Polling pauses while the tab is hidden. A response younger than
 * the interval is kept unless one of its deadlines has passed since it was fetched.
 */
export function automaticRefreshDecision(input: {
  state: RefreshState;
  now: EpochMs;
  /** Seconds, after server control. */
  interval: number;
  hidden: boolean;
  offline?: boolean;
  snapshot?: MarketSnapshot;
}): RefreshDecision {
  const { state, now, interval, snapshot } = input;
  if (input.hidden) return "paused";
  if (state.nextAttemptNotBefore !== undefined && now < state.nextAttemptNotBefore) return "backoff";
  const last = state.lastSuccessAt;
  if (!input.offline && last !== undefined && snapshot && now - last < interval * SECOND_MS && !hasExpiredSinceFetch(snapshot, last, now)) {
    return "fresh";
  }
  return "fetch";
}

/** Realtime announcements trigger a reload only outside maintenance and backoff. */
export const acceptsAnnouncement = (input: { state: RefreshState; now: EpochMs; control?: MarketClientControl }) =>
  !input.control?.maintenance &&
  !(input.state.nextAttemptNotBefore !== undefined && input.now < input.state.nextAttemptNotBefore);

/** Milliseconds the automatic loop waits before its next tick: the cadence or the remaining backoff. */
export function nextAutomaticWait(state: RefreshState, now: EpochMs, interval: number): number {
  const backoff = state.nextAttemptNotBefore === undefined ? 0 : state.nextAttemptNotBefore - now;
  return Math.max(interval * SECOND_MS, backoff);
}
