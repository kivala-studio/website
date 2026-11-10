import { describe, expect, it } from "vitest";

import {
  INITIAL_REFRESH_STATE,
  type RefreshState,
  automaticRefreshDecision,
  backoffSeconds,
  nextAutomaticWait,
  parseRetryAfterSeconds,
  recordRefreshFailure,
  recordRefreshSuccess,
} from "./refresh";
import { SECOND_MS } from "./zone";

const INTERVAL = 30;

/** A repository that fails `failures` times, driven through the refresh reducers with an injected clock. */
function failingLoop(failures: number, start: number) {
  let remaining = failures;
  let state: RefreshState = INITIAL_REFRESH_STATE;
  let requests = 0;
  const attempt = (now: number) => {
    requests += 1;
    if (remaining > 0) {
      remaining -= 1;
      state = recordRefreshFailure(state, { now, interval: INTERVAL, offline: false, randomUnit: 1 });
    } else {
      state = recordRefreshSuccess(now);
    }
  };
  return {
    clock: start,
    get state() {
      return state;
    },
    get requests() {
      return requests;
    },
    /** Automatic tick: true when a request was made. */
    refreshIfNeeded(now: number) {
      if (automaticRefreshDecision({ state, now, interval: INTERVAL, hidden: false }) !== "fetch") return false;
      attempt(now);
      return true;
    },
    /** Pull to refresh ignores the backoff window. */
    load(now: number) {
      attempt(now);
      return true;
    },
  };
}

describe("market refresh backoff", () => {
  it("backoff policy", () => {
    const cases: [failures: number, retryAfter: number | undefined, unit: number, expected: number][] = [
      [1, undefined, 1, 30],
      [2, undefined, 0, 30],
      [2, undefined, 1, 60],
      [3, undefined, 0.5, 60],
      [3, undefined, 1, 120],
      [12, undefined, 1, 300],
      [1, 90, 0, 90],
      [4, 90, 0, 90],
      [1, 3600, 1, 300],
    ];
    for (const [failures, retryAfter, randomUnit, expected] of cases) {
      expect(backoffSeconds({ failures, base: 30, retryAfter, randomUnit })).toBe(expected);
    }
  });

  it("the server retry hint is read from the function error body", () => {
    expect(parseRetryAfterSeconds(`{"error":{"code":"SNAPSHOT_UNAVAILABLE"},"retry_after_seconds":45}`)).toBe(45);
    expect(parseRetryAfterSeconds("{}")).toBeUndefined();
  });

  it("repeated failures back off automatic refresh but not pull to refresh", () => {
    const store = failingLoop(2, 10_000 * SECOND_MS);
    let now = store.clock;
    store.refreshIfNeeded(now);
    expect(store.state.consecutiveFailures).toBe(1);
    expect(store.state.nextAttemptNotBefore).toBe(now + 30 * SECOND_MS);

    now += 30 * SECOND_MS;
    store.refreshIfNeeded(now);
    expect(store.state.consecutiveFailures).toBe(2);
    expect(store.state.nextAttemptNotBefore).toBe(now + 60 * SECOND_MS);

    now += 45 * SECOND_MS;
    expect(store.refreshIfNeeded(now)).toBe(false);
    expect(store.requests).toBe(2);

    expect(store.load(now)).toBe(true);
    expect(store.requests).toBe(3);
    expect(store.state.consecutiveFailures).toBe(0);
    expect(store.state.nextAttemptNotBefore).toBeUndefined();
  });

  it("the automatic loop waits until the backoff ends", () => {
    const store = failingLoop(2, 10_000 * SECOND_MS);
    let now = store.clock;
    const waits: number[] = [];
    while (waits.length < 2) {
      store.refreshIfNeeded(now);
      waits.push(nextAutomaticWait(store.state, now, INTERVAL));
      now += 30 * SECOND_MS;
    }
    expect(waits).toEqual([30 * SECOND_MS, 60 * SECOND_MS]);
  });
});
