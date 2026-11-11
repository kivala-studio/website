import Decimal from "decimal.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError, CancellationError, presentError } from "@/domain/errors";
import { hasUsableQuote, hasUsableStatistics, marketSecurity, marketSnapshot } from "@/domain/market";
import { DAY_MS, SECOND_MS } from "@/domain/market/zone";

import { observeConnectivity } from "./connectivity";
import { MarketStore, type MarketStoreOptions } from "./store";
import { Deferred, ScriptedRepository, T, fixtureCalendar, fixtureSnapshot } from "./test-support";

/*
 * Ports, case for case:
 *   QuoteRecoveryTests.swift (store cases; the domain cases are in domain/market/quote-recovery.test.ts)
 *   MarketConnectivityMonitorTests.swift
 *   QuoteAnnouncementTests.swift
 *   ErrorRecoveryTests.swift (market cases; history, watchlist, alert and notification cases are todos)
 * The clock is injected; the expiry timer runs on fake timers. Nothing sleeps.
 */

let now = T;
const clock = () => now;
const offline = () => new AppError("offline", { operation: "test" });

function makeStore(repository: ScriptedRepository, options: Partial<MarketStoreOptions> = {}) {
  return new MarketStore({ repository, now: clock, ...options });
}

const loaded = (store: MarketStore) => {
  const { load } = store.getSnapshot();
  if (load.kind !== "loaded") throw new Error(`Expected loaded state, got ${load.kind}`);
  return load.snapshot;
};

beforeEach(() => {
  vi.useFakeTimers();
  now = T;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("quote recovery (store)", () => {
  for (const fails of [false, true]) {
    it(fails ? "background failure cannot revoke recovered quotes" : "background response cannot replace a recovered observation at the same price", async () => {
      const repository = new ScriptedRepository();
      const store = makeStore(repository);
      await store.load();
      const hold = repository.holdQuote();
      const oldRequest = store.load({ force: true });
      await hold.started;
      store.suspend({ preservingContent: true });
      now += 60 * SECOND_MS;
      repository.snapshot = fixtureSnapshot(now);
      expect(await store.load({ force: true })).toBe(true);
      hold.release(fails ? new AppError("timeout", { operation: "test" }) : undefined);
      expect(await oldRequest).toBe(false);
      const recovered = loaded(store).securities[0];
      expect(recovered.price.toString()).toBe("100");
      expect(recovered.quoteQuality?.sourceObservedAtEpoch).toBe(now / SECOND_MS);
      expect(hasUsableQuote(recovered, now)).toBe(true);
      expect(store.getSnapshot().refreshError).toBeNull();
      store.reset();
    });
  }

  it("late calendar restores statistics without another quote request", async () => {
    const repository = new ScriptedRepository();
    const hold = repository.holdCalendar();
    const store = makeStore(repository);
    const load = store.load();
    await hold.started;
    expect(store.getSnapshot().load.kind).toBe("loading");
    hold.release();
    await load;
    const recovered = loaded(store);
    expect(recovered.status).toBe("open");
    expect(hasUsableStatistics(recovered, T)).toBe(true);
    expect(recovered.sessionVolume.toString()).toBe("1000");
    expect(repository.quoteRequests).toBe(1);
    store.reset();
  });

  it("transient calendar failure keeps the verified calendar until its deadline", async () => {
    const repository = new ScriptedRepository();
    const store = makeStore(repository);
    await store.load();
    const calendarFailed = repository.failCalendar();
    now += 31 * SECOND_MS;
    await store.refreshIfNeeded();
    await calendarFailed;
    expect(store.getSnapshot().calendar?.state(now)).toBe("open");
    now = fixtureCalendar().validUntil;
    store.reassessCurrentQuotes();
    const expired = loaded(store);
    expect(expired.status).toBe("unknown");
    expect(hasUsableStatistics(expired, now)).toBe(false);
    store.reset();
  });

  it("expiry between polls reassesses and fetches once before the throttle", async () => {
    const repository = new ScriptedRepository(fixtureSnapshot(T, 10));
    const store = makeStore(repository);
    await store.load();
    expect(vi.getTimerCount()).toBe(1);
    now += 11 * SECOND_MS;
    await vi.advanceTimersByTimeAsync(11 * SECOND_MS);
    expect(loaded(store).securities[0].quoteQuality?.status).toBe("stale");
    expect(store.dataAvailability()?.state).toBe("delayed");
    expect(store.dataAvailability()?.lastSuccessfulObservationAt).toBe(T);
    await store.refreshIfNeeded();
    await store.refreshIfNeeded();
    expect(repository.quoteRequests).toBe(2);
    store.reset();
  });

  it("offline failure retries and reconnect bypasses the recent-fetch throttle", async () => {
    const repository = new ScriptedRepository();
    const store = makeStore(repository);
    await store.load();
    store.setConnectivity(true);
    repository.failNext(offline());
    await store.refreshIfNeeded();
    expect(store.dataAvailability()?.state).toBe("offline");
    expect(repository.quoteRequests).toBe(2);
    store.setConnectivity(false);
    await store.refreshIfNeeded();
    expect(repository.quoteRequests).toBe(3);
    expect(store.dataAvailability()?.state).toBe("available");
    store.reset();
  });

  it("cancelling one waiter does not cancel the shared quote request", async () => {
    const repository = new ScriptedRepository();
    const store = makeStore(repository);
    await store.load();
    repository.snapshot = fixtureSnapshot(T + SECOND_MS);
    const hold = repository.holdQuote();
    const caller = new AbortController();
    const refresh = store.load({ force: true, signal: caller.signal });
    await hold.started;
    const duplicate = store.load({ force: true });
    expect(repository.quoteRequests).toBe(2);
    caller.abort();
    hold.release();
    expect(await refresh).toBe(false);
    expect(await duplicate).toBe(true);
    expect(loaded(store).securities[0].quoteQuality?.sourceObservedAtEpoch).toBe(T / SECOND_MS + 1);
    expect(store.getSnapshot().isRefreshing).toBe(false);
    expect(store.getSnapshot().refreshError).toBeNull();
    store.reset();
  });

  it("foreground starts a new calendar read before the old cancelled transport returns", async () => {
    const repository = new ScriptedRepository();
    const hold = repository.holdCalendar();
    const store = makeStore(repository);
    const oldLoad = store.load();
    await hold.started;
    store.suspend({ preservingContent: true });
    await store.load({ force: true });
    expect(repository.calendarRequests).toBe(2);
    expect(store.dataAvailability()?.state).toBe("available");
    hold.release();
    expect(await oldLoad).toBe(false);
    expect(store.dataAvailability()?.state).toBe("available");
    store.reset();
  });
});

/** iOS `UncooperativePaths`: delivers a late event even after the observer was cancelled. */
class Paths {
  private waiter: Deferred<boolean | null> | undefined;
  private waiting: Deferred[] = [];
  private index = 0;

  constructor(count: number) {
    this.waiting = Array.from({ length: count }, () => new Deferred());
  }

  waitingFor(index: number): Promise<void> {
    return this.waiting[index].promise;
  }

  next = (): Promise<boolean | null> => {
    this.waiter = new Deferred();
    this.waiting[this.index++]?.resolve();
    return this.waiter.promise;
  };

  send(offline: boolean | null): void {
    this.waiter?.resolve(offline);
    this.waiter = undefined;
  }
}

describe("market connectivity monitor", () => {
  const emptyRepository = () =>
    new ScriptedRepository(marketSnapshot({ status: "open", securities: [], updatedAt: T }), null);

  it("active monitor recovers from an offline path without a user action", async () => {
    const paths = new Paths(3);
    const repository = emptyRepository();
    const store = makeStore(repository);
    await store.load();
    const scene = new AbortController();
    const observer = observeConnectivity(paths.next, store, scene.signal);
    await paths.waitingFor(0);
    paths.send(true);
    await paths.waitingFor(1);
    expect(store.getSnapshot().isOffline).toBe(true);
    paths.send(false);
    await paths.waitingFor(2);
    await vi.waitFor(() => expect(repository.quoteRequests).toBe(2));
    scene.abort();
    paths.send(null);
    await observer;
    expect(repository.quoteRequests).toBe(2);
    expect(store.getSnapshot().isOffline).toBe(false);
  });

  it("a cancelled page rejects a late reconnect and keeps the store suspended", async () => {
    const paths = new Paths(2);
    const repository = emptyRepository();
    const store = makeStore(repository);
    await store.load();
    const scene = new AbortController();
    const observer = observeConnectivity(paths.next, store, scene.signal);
    await paths.waitingFor(0);
    paths.send(true);
    await paths.waitingFor(1);
    // The page hides: the observer is cancelled and the store suspended with its content.
    scene.abort();
    store.suspend({ preservingContent: true });
    const generation = store.foregroundGeneration;
    paths.send(false);
    await observer;
    expect(repository.quoteRequests).toBe(1);
    expect(store.foregroundGeneration).toBe(generation);
    expect(store.getSnapshot().isOffline).toBe(true);
    expect(store.getSnapshot().hasLoadedLiveSnapshot).toBe(true);
    store.suspend({ preservingContent: true });
    expect(store.foregroundGeneration).toBe(generation);
    expect(store.getSnapshot().isRefreshing).toBe(false);
    expect(store.getSnapshot().load.kind).toBe("loaded");
  });
});

describe("quote announcements", () => {
  const announced = (generatedAt?: number, etag?: string) =>
    new ScriptedRepository(
      marketSnapshot({
        status: "open",
        securities: [],
        updatedAt: 1000,
        sourceMetadata: { snapshotGeneratedAt: generatedAt, snapshotETag: etag },
      }),
      null,
    );
  const noWait = async () => {};

  beforeEach(() => {
    now = 10_000 * SECOND_MS;
  });

  it("an announcement no newer than the loaded snapshot is ignored", async () => {
    const built = 9_990 * SECOND_MS;
    const repository = announced(built);
    const store = makeStore(repository, { sleep: noWait });
    await store.load({ force: true });
    now += 20 * SECOND_MS;
    await store.applyQuoteAnnouncement({ generatedAt: built });
    expect(repository.quoteRequests).toBe(1);
    await store.applyQuoteAnnouncement({ generatedAt: built + 15 * SECOND_MS });
    expect(repository.quoteRequests).toBe(2);
  });

  it("an announcement waits a jittered delay and collapses a burst", async () => {
    const repository = announced();
    const waits: number[] = [];
    const store = makeStore(repository, {
      random: () => 0.4,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    await store.load({ force: true });
    now += 20 * SECOND_MS;
    await store.applyQuoteAnnouncement({});
    now += 3 * SECOND_MS;
    await store.applyQuoteAnnouncement({});
    expect(repository.quoteRequests).toBe(2);
    expect(waits).toEqual([4 * SECOND_MS]);
  });

  it("an announcement during backoff does not load", async () => {
    const repository = announced();
    const store = makeStore(repository, { random: () => 1, sleep: noWait });
    await store.load({ force: true });
    const unavailable = () => new AppError("serviceUnavailable", { operation: "test" });
    repository.failNext(unavailable(), unavailable());
    now += 60 * SECOND_MS;
    await store.refreshIfNeeded();
    now += 30 * SECOND_MS;
    await store.refreshIfNeeded();
    expect(store.getSnapshot().refresh.consecutiveFailures).toBe(2);
    now += 10 * SECOND_MS;
    await store.applyQuoteAnnouncement({});
    expect(repository.quoteRequests).toBe(3);
  });

  it("an announcement carrying the held ETag is ignored", async () => {
    const repository = announced(9_990 * SECOND_MS, 'W/"held"');
    const store = makeStore(repository, { sleep: noWait });
    await store.load({ force: true });
    now += 20 * SECOND_MS;
    await store.applyQuoteAnnouncement({ generatedAt: now, etag: 'W/"held"' });
    expect(repository.quoteRequests).toBe(1);
  });
});

describe("error recovery (market)", () => {
  const snapshot = () =>
    marketSnapshot({
      status: "open",
      securities: [
        marketSecurity({
          id: "AAA",
          symbol: "AAA",
          name: "Título",
          kind: "equity",
          price: new Decimal(100),
          volume: new Decimal(10),
          history: [{ date: 0, value: new Decimal(100) }],
        }),
      ],
      sessionVolume: new Decimal(100),
      trades: 1,
      updatedAt: 0,
    });

  it("refresh failure preserves data and the original timestamp, then a retry recovers", async () => {
    const original = snapshot();
    const repository = new ScriptedRepository(original, null);
    const store = makeStore(repository, { initialState: { kind: "loaded", snapshot: original } });
    await store.load();
    repository.failNext(offline());
    expect(await store.load({ force: true })).toBe(false);
    const retained = loaded(store);
    expect(retained.updatedAt).toBe(original.updatedAt);
    expect(retained.securities[0].history).toEqual(original.securities[0].history);
    expect(hasUsableQuote(retained.securities[0], now)).toBe(false);
    expect(store.getSnapshot().refreshError?.category).toBe("offline");
    expect(store.getSnapshot().isRefreshing).toBe(false);
    expect(await store.load({ force: true })).toBe(true);
    expect(store.getSnapshot().refreshError).toBeNull();
    const refreshed = loaded(store);
    expect(refreshed.updatedAt).toBe(original.updatedAt);
    expect(refreshed.status).toBe("unknown");
  });

  it("initial failure has a recoverable state and no global alert", async () => {
    const repository = new ScriptedRepository(snapshot(), null);
    repository.failNext(offline());
    const store = makeStore(repository);
    await store.load();
    const { load } = store.getSnapshot();
    if (load.kind !== "failed") throw new Error("Expected initial error");
    expect(load.error.category).toBe("offline");
    expect(presentError(load.error).style).toBe("fullContent");
    expect(store.errors.current).toBeNull();
    expect(store.getSnapshot().refreshError).toBeNull();
  });

  it("initial cancellation returns to idle without presentation", async () => {
    const repository = new ScriptedRepository(snapshot(), null);
    repository.failNext(new CancellationError());
    const store = makeStore(repository);
    await store.load();
    expect(store.getSnapshot().load.kind).toBe("idle");
    expect(store.getSnapshot().refreshError).toBeNull();
    expect(store.errors.current).toBeNull();
  });

  it("a cancelled waiter cannot invalidate the store-owned request", async () => {
    const repository = new ScriptedRepository(snapshot(), null);
    const hold = repository.holdQuote();
    const store = makeStore(repository);
    const caller = new AbortController();
    const task = store.load({ signal: caller.signal });
    await hold.started;
    caller.abort();
    hold.release();
    await task;
    await vi.waitFor(() => expect(store.getSnapshot().hasLoadedLiveSnapshot).toBe(true));
    expect(store.errors.current).toBeNull();
  });

  it("reset invalidates a late result and shared waiters", async () => {
    const repository = new ScriptedRepository(snapshot(), null);
    const hold = repository.holdQuote();
    const store = makeStore(repository);
    const first = store.load();
    await hold.started;
    const duplicate = store.load({ force: true });
    expect(repository.quoteRequests).toBe(1);
    store.reset();
    hold.release();
    await first;
    expect(await duplicate).toBe(false);
    expect(store.getSnapshot().load.kind).toBe("idle");
    expect(store.getSnapshot().refreshError).toBeNull();
  });

  it.todo("repeated failed watchlist writes restore confirmed membership (W8)");
  it.todo("older intraday request cannot overwrite a newer trading day (W7)");
  it.todo("cancelled intraday caller still loads the chart (W7)");
  // Daily-history halves of the iOS cases; the intraday halves belong to W7 (todos above).
  it("history failures preserve the series and retry the original range", async () => {
    const repository = new ScriptedRepository();
    const series = [{ date: T - DAY_MS, value: new Decimal(99) }];
    repository.histories.set("SEC", series);
    const store = makeStore(repository);
    await store.load();
    expect(await store.loadHistory("SEC")).toBe(true);
    repository.historyFailure = new AppError("timeout", { operation: "test" });
    expect(await store.loadHistory("SEC", { force: true })).toBe(false);
    expect(store.getSnapshot().historyErrors.SEC?.category).toBe("timeout");
    expect(store.getSnapshot().histories.SEC).toEqual(series);
    repository.historyFailure = undefined;
    expect(await store.loadHistory("SEC")).toBe(true);
    expect(store.getSnapshot().historyErrors.SEC).toBeUndefined();
    expect(repository.historyRequests).toEqual(["SEC", "SEC", "SEC"]);
    expect(store.getSnapshot().loadingHistories).toEqual({});
  });

  it("empty history is valid data", async () => {
    const repository = new ScriptedRepository();
    const store = makeStore(repository);
    await store.load();
    expect(await store.loadHistory("SEC")).toBe(true);
    expect(store.getSnapshot().historyErrors.SEC).toBeUndefined();
    expect(store.getSnapshot().histories.SEC).toEqual([]);
    expect(await store.loadHistory("SEC")).toBe(true);
    expect(repository.historyRequests).toEqual(["SEC"]);
  });
  it.todo("watchlist failure rolls back, then retry persists the original operation (W8)");
  it.todo("a new watchlist intent supersedes an obsolete retry (W8)");
  it.todo("alert write failure rolls back and grouped retry recovers (W8)");
  it.todo("alerts initial failure, cancellation and valid empty state (W8)");
  it.todo("notification write failure restores unread state (W9)");
});

