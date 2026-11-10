import { describe, expect, it } from "vitest";

import fixture from "../../../tests/fixtures/home-compact-contract.json";
import { decodeMarketCalendar } from "./calendar";
import { isVisibleOutsideSearch } from "./classification";
import { decodeHomeProjectionResponse, decodeSnapshotBundle } from "./decode";
import { MarketDecodingError } from "./decoding-error";
import { acceptSnapshotBundle, buildHomeProjection, buildMarketSnapshot } from "./mapping";
import { displayPrice, hasUsableQuote } from "./quote-policy";
import {
  type HomeMarketProjection,
  applyCurrentQuotePolicy,
  dataAvailability,
  hasUsableStatistics,
  projectionAvailability,
  projectionExpiryDates,
  projectionSnapshot,
  revokeCurrentQuotes,
} from "./snapshot";
import { minuteOfDay, parseInstant } from "./zone";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const now = (parseInstant(fixture.generated_at) ?? Number.NaN) + 1;
const anchor = Math.floor(now / 1000);
const copy = (): Json => structuredClone(fixture);

function project(json: Json = copy()) {
  const projection = buildHomeProjection(decodeHomeProjectionResponse(json), now);
  if (!projection) throw new Error("expected a compact projection");
  return projection;
}

const syntheticID = (index: number) => `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`;

/** The full `market-snapshot` bundle the transport serves next to the compact projection. */
function fullBundle(compact: Json = copy()): Json {
  const ids = Array.from({ length: 600 }, (_, index) => index);
  const quality = { status: "valid", reasons: [], validUntilEpoch: anchor + 120, sourceObservedAtEpoch: anchor };
  return {
    contract_version: 1,
    generated_at: fixture.generated_at,
    securities: ids.map((index) => ({ id: syntheticID(index), symbol: `SEC${index}`, name: `Synthetic ${index}`, security_type: "stock", currency: "AOA", is_active: true })),
    quotes: {
      prices: ids.map((index) => ({ security_id: syntheticID(index), trading_date: "2026-10-07", last_price: 100, volume: 10, data_quality: quality })),
      sessions: [{ trading_date: "2026-10-07", total_volume: 6000, trade_count: 600, status: "open", data_quality: quality }],
      overview: [{ status: "open", data_status: "fresh", source_trading_date: "2026-10-07" }],
      reference_prices: compact.quotes.reference_prices,
      availability: compact.quotes.availability,
      active_security_ids: compact.quotes.active_security_ids,
    },
    closes: ids.map((index) => ({ security_id: syntheticID(index), price: 90, trading_date: "2026-10-06", confirmed_at: "2026-10-06T15:00:00Z" })),
    calendar: compact.calendar,
  };
}

function loadFull(json: Json = fullBundle()) {
  const bundle = decodeSnapshotBundle(json);
  const generatedAt = acceptSnapshotBundle(bundle, now);
  const snapshot = buildMarketSnapshot({ securities: bundle.securities, quotes: bundle.quotes, closes: bundle.closes, generatedAt }, now);
  return applyCurrentQuotePolicy(snapshot, bundle.calendar && decodeMarketCalendar(bundle.calendar, now), now);
}

describe("Home compact contract", () => {
  // iOS also counts transport requests and timings; those belong to the data layer.
  it("publishes the projection before the complete catalogue for cold start, resume and refresh", () => {
    let retained: ReturnType<typeof loadFull> | undefined;
    for (const phase of ["cold", "resume", "refresh"]) {
      if (phase === "resume" && retained) retained = revokeCurrentQuotes(retained, undefined, now);
      const projection = project();
      expect(projection.summary.instrumentCount).toBe(600);
      expect(projection.cards.securities).toHaveLength(3);
      expect(projectionAvailability(projection, now, false).state).toBe("available");
      if (phase === "cold") expect(retained).toBeUndefined();
      else expect(retained?.securities).toHaveLength(600);
      const complete = loadFull();
      expect(complete.securities).toHaveLength(600);
      expect(complete.securities.every((security) => hasUsableQuote(security, now))).toBe(true);
      expect(complete.securities.some((security) => security.id.endsWith("000000000599"))).toBe(true);
      retained = complete;
    }
  });

  it("expiry keeps the visible reference but removes financial eligibility and the current count", () => {
    const projection = project();
    const expired = projection.summary.validUntilEpoch * 1000;
    expect(projectionAvailability(projection, expired, false).availableInstrumentCount).toBe(0);
    const snapshot = projectionSnapshot(projection, expired);
    expect(snapshot.securities.every((security) => !hasUsableQuote(security, expired))).toBe(true);
    expect(snapshot.securities.every((security) => displayPrice(security, expired) !== undefined)).toBe(true);
    expect(projectionAvailability(projection, now, true).state).toBe("offline");
    expect(projection.summary.instrumentCount).toBe(600);
  });

  it("a zero-quote projection schedules an independent statistics expiry", () => {
    const json = copy();
    const deadline = (anchor + 20) * 1000;
    json.quotes.sessions[0].data_quality.validUntilEpoch = anchor + 20;
    json.quotes.prices = [];
    json.securities = [];
    json.summary.available_quote_count = 0;
    const projection = project(json);
    expect(projection.cards.securities).toEqual([]);
    expect(projectionExpiryDates(projection)).toContain(deadline);
    expect(hasUsableStatistics(projectionSnapshot(projection, now), now)).toBe(true);
    expect(hasUsableStatistics(projectionSnapshot(projection, deadline), deadline)).toBe(false);
    expect(projection.summary.instrumentCount).toBe(600);
  });

  it("card quotes schedule their expiry after an earlier statistics and summary deadline", () => {
    const json = copy();
    const quoteDeadline = (anchor + 60) * 1000;
    const statisticsDeadline = (anchor + 20) * 1000;
    for (const price of json.quotes.prices) price.data_quality.validUntilEpoch = anchor + 60;
    json.quotes.sessions[0].data_quality.validUntilEpoch = anchor + 20;
    json.summary.valid_until_epoch = anchor + 20;
    const projection = project(json);
    expect(projection.cards.securities.length).toBeGreaterThan(0);
    expect(projectionExpiryDates(projection)).toContain(statisticsDeadline);
    expect(projectionExpiryDates(projection)).toContain(quoteDeadline);
    const afterStatistics = projectionSnapshot(projection, statisticsDeadline);
    expect(hasUsableStatistics(afterStatistics, statisticsDeadline)).toBe(false);
    expect(afterStatistics.securities.every((security) => hasUsableQuote(security, statisticsDeadline))).toBe(true);
    const afterQuotes = projectionSnapshot(projection, quoteDeadline);
    expect(afterQuotes.securities.every((security) => !hasUsableQuote(security, quoteDeadline))).toBe(true);
    expect(afterQuotes.securities.every((security) => displayPrice(security, quoteDeadline) !== undefined)).toBe(true);
  });

  it("the session close moves the aggregate before the source deadline", () => {
    const projection = project();
    const calendar = projection.calendar.with({
      version: "synthetic-close",
      normalHours: { openingMinute: 0, closingMinute: minuteOfDay(now) + 1 },
      exceptions: new Map(),
      regularWeekdays: new Set([1, 2, 3, 4, 5, 6, 7]),
    });
    const closing: HomeMarketProjection = { ...projection, calendar, generatedAt: now };
    const boundary = calendar.nextTransition(now);
    expect(boundary).toBeDefined();
    expect(projectionExpiryDates(closing)).toContain(boundary);
    expect(boundary!).toBeLessThan(projection.summary.validUntilEpoch * 1000);
    expect(projectionSnapshot(closing, boundary!).status).toBe("closed");
    expect(projectionAvailability(closing, boundary!, false).state).toBe("historical");
    expect(projectionAvailability(closing, boundary!, false).availableInstrumentCount).toBe(0);
  });

  it("unsupported and older backends request the full fallback", () => {
    for (const json of [{ contract_version: 1, requires_full_snapshot: true }, { prices: [], sessions: [], overview: [] }]) {
      expect(buildHomeProjection(decodeHomeProjectionResponse(json), now)).toBeUndefined();
    }
  });

  it("a malformed contract cannot publish counts or current prices", () => {
    const mutations: ((json: Json) => void)[] = [
      (json) => json.securities.push(json.securities[0]),
      (json) => (json.summary.available_quote_count = 601),
      (json) => (json.summary.valid_until_epoch = now / 1000 - 1),
      (json) => (json.calendar.days = []),
      (json) => (json.quotes.prices[0].last_price = -1),
    ];
    for (const mutate of mutations) {
      const json = copy();
      mutate(json);
      expect(() => project(json)).toThrow(MarketDecodingError);
    }
  });

  it("reference and active coverage agree for full and compact reads", () => {
    const json = copy();
    const id = syntheticID(0);
    json.quotes.reference_prices = [{
      security_id: id,
      reference_price: {
        price: 90,
        price_date: "2026-10-06",
        collected_at: "2026-10-07T13:37:44Z",
        source_url: "https://www.bodiva.ao/history?symbol=SEC0",
        source_hash: "a".repeat(64),
        parser_version: "fixture-v1",
      },
    }];
    json.quotes.active_security_ids = Array.from({ length: 599 }, (_, index) => syntheticID(index));
    const counts = { session_quote_count: 599, reference_price_count: 0, missing_price_count: 0, active_instrument_count: 599 };
    Object.assign(json.quotes.availability, counts);
    Object.assign(json.summary, { instrument_count: 599, available_quote_count: 599, ...counts });
    const compact = project(json);
    const full = loadFull(fullBundle(json));
    expect(projectionAvailability(compact, now, false).coverage).toEqual(dataAvailability(full, now).coverage);
    expect(full.securities).toHaveLength(600);
    const retained = full.securities.find((security) => security.id.endsWith("000000000599"));
    expect(retained?.officialMarketVisibility).toBe(false);
    expect(retained?.isListed).toBe(true);
    expect(isVisibleOutsideSearch(retained!, now)).toBe(false);
    expect(hasUsableQuote(retained!, now)).toBe(true);
    expect(full.securities[0].referencePrice).toEqual(compact.cards.securities[0].referencePrice);
    expect(full.securities[0].referencePrice?.price.toNumber()).toBe(90);
    expect(displayPrice(compact.cards.securities[0], now)?.toNumber()).toBe(100);
    expect(compact.cards.securities).toHaveLength(3);
    expect(dataAvailability(full, now).coverage?.activeInstrumentCount).toBe(599);
  });
});

describe("tolerant market decoding", () => {
  it("a malformed security drops only that row from the snapshot", () => {
    const bundle = decodeSnapshotBundle(
      JSON.parse(`{"contract_version":1,"generated_at":"2026-11-10T10:00:00Z",
        "securities":[{"id":"A","symbol":"BAIAAAAA","security_type":"stock","currency":"AOA","is_active":true},
        {"id":"B","symbol":null,"security_type":"stock","currency":"AOA","is_active":true}],
        "quotes":{"prices":[],"sessions":[],"overview":[]},"closes":null}`),
    );
    expect(bundle.securities.map((security) => security.id)).toEqual(["A"]);
  });
});
