import Decimal from "decimal.js";

import {
  MarketCalendar,
  type MarketCalendar as Calendar,
  type MarketClientControl,
  type MarketIndex,
  type MarketSnapshot,
  type PricePoint,
  EMPTY_MARKET_INDEX,
  marketSecurity,
  marketSnapshot,
} from "@/domain/market";
import { DAY_MS, SECOND_MS, parseInstant, startOfDay } from "@/domain/market/zone";

import type { MarketRepository } from "./repository";

/** Test-only helpers shared by the store test files. */

export class Deferred<T = void> {
  resolve!: (value: T) => void;
  reject!: (error: unknown) => void;
  readonly promise = new Promise<T>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });
}

/** iOS `QuoteFixture`: Tuesday 2026-10-06 11:00 in Luanda, session 09:00–15:00. */
export const T = parseInstant("2026-10-06T10:00:00Z")!;

export const fixtureCalendar = (now = T): Calendar =>
  new MarketCalendar({
    version: "fixture",
    coverage: { start: startOfDay(now), endExclusive: startOfDay(now) + DAY_MS },
    verifiedAt: now - SECOND_MS,
    validUntil: now + 600 * SECOND_MS,
    normalHours: { openingMinute: 9 * 60, closingMinute: 15 * 60 },
    regularWeekdays: new Set([2, 3, 4, 5, 6]),
  });

export function fixtureSnapshot(observedAt = T, deadlineSeconds = 120): MarketSnapshot {
  const quality = {
    status: "valid" as const,
    reasons: [],
    observedAt: startOfDay(observedAt),
    validUntilEpoch: (observedAt + deadlineSeconds * SECOND_MS) / SECOND_MS,
    sourceObservedAtEpoch: observedAt / SECOND_MS,
  };
  return marketSnapshot({
    status: "open",
    securities: [
      marketSecurity({
        id: "SEC",
        symbol: "SEC",
        kind: "equity",
        price: new Decimal(100),
        isWatched: true,
        history: [{ date: T - DAY_MS, value: new Decimal(99) }],
        quoteQuality: quality,
        quoteTradingDate: observedAt,
        isListed: true,
      }),
    ],
    sessionVolume: new Decimal(1000),
    trades: 2,
    updatedAt: observedAt,
    statisticsQuality: quality,
    sourceMetadata: {
      tradingDate: observedAt,
      collectedAt: observedAt,
      publishedAt: observedAt,
      dataStatus: "live",
      sourceObservedAt: observedAt,
    },
  });
}

/** A scripted repository: counts quote requests and can hold or fail the next quote or calendar read. */
export class ScriptedRepository implements MarketRepository {
  quoteRequests = 0;
  calendarRequests = 0;
  control: MarketClientControl | undefined;
  private failures: unknown[] = [];
  private quoteHold: { started: Deferred; release: Deferred<unknown> } | undefined;
  private calendarHold: { started: Deferred; release: Deferred } | undefined;
  private calendarFailure: Deferred | undefined;

  constructor(
    public snapshot: MarketSnapshot = fixtureSnapshot(),
    public calendar: Calendar | null = fixtureCalendar(),
  ) {}

  failNext(...errors: unknown[]): void {
    this.failures.push(...errors);
  }

  /** The next quote request waits (ignoring cancellation, like a late transport callback). */
  holdQuote(): { started: Promise<void>; release: (failure?: unknown) => void } {
    const hold = { started: new Deferred(), release: new Deferred<unknown>() };
    this.quoteHold = hold;
    return { started: hold.started.promise, release: (failure) => hold.release.resolve(failure) };
  }

  holdCalendar(): { started: Promise<void>; release: () => void } {
    const hold = { started: new Deferred(), release: new Deferred() };
    this.calendarHold = hold;
    return { started: hold.started.promise, release: () => hold.release.resolve() };
  }

  failCalendar(): Promise<void> {
    this.calendarFailure = new Deferred();
    return this.calendarFailure.promise;
  }

  async fetchLightSnapshot(): Promise<MarketSnapshot> {
    this.quoteRequests += 1;
    if (this.failures.length > 0) throw this.failures.shift();
    const response = this.snapshot;
    const hold = this.quoteHold;
    if (hold) {
      this.quoteHold = undefined;
      hold.started.resolve();
      const failure = await hold.release.promise;
      if (failure) throw failure;
    }
    return response;
  }

  async fetchTradingCalendar(): Promise<Calendar | undefined> {
    this.calendarRequests += 1;
    const hold = this.calendarHold;
    if (hold) {
      this.calendarHold = undefined;
      hold.started.resolve();
      await hold.release.promise;
    }
    const failure = this.calendarFailure;
    if (failure) {
      this.calendarFailure = undefined;
      failure.resolve();
      throw new TypeError("fetch failed: timed out");
    }
    return this.calendar ?? undefined;
  }

  async fetchMarketIndex(): Promise<MarketIndex> {
    return EMPTY_MARKET_INDEX;
  }

  /** Daily history per security; `historyFailure` fails every history read until cleared. */
  histories = new Map<string, PricePoint[]>();
  historyFailure: unknown;
  historyRequests: string[] = [];

  async fetchDailyHistory(securityID: string): Promise<PricePoint[]> {
    this.historyRequests.push(securityID);
    if (this.historyFailure) throw this.historyFailure;
    return this.histories.get(securityID) ?? [];
  }

  clientControl(): MarketClientControl | undefined {
    return this.control;
  }
}
