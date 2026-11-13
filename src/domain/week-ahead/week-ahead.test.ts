import { describe, expect, it } from "vitest";

import pt from "../../../messages/pt.json";
import { createFormat } from "../format";
import { type CalendarException, MarketCalendar } from "../market/calendar";
import { dayStart, parseInstant } from "../market/zone";
import { weekAheadText } from "./presentation";
import {
  type EventKind,
  type EventSource,
  type EventTiming,
  type MarketEvent,
  type WeekContext,
  dividendEvents,
  eventDay,
  hasValidProvenance,
  isValidTiming,
  isWeekAheadSunday,
  nextWeek,
  overlaps,
  selectWeek,
  verifiedClosures,
  weekAheadOffer,
} from "./week-ahead";

// Ported from iOS `WeekAheadTests` (Home resolver and store-cache cases stay with W14).

const translate = (key: string, values?: Record<string, string>) => {
  const found = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], pt);
  const text = typeof found === "string" ? found : key;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => values?.[name] ?? `{${name}}`);
};
const text = weekAheadText(translate, createFormat("pt", translate));

const instant = (value: string) => parseInstant(value) ?? Number.NaN;
const day = (value: string) => dayStart(value)!;
const now = instant("2026-09-27T11:00:00+01:00");
const period = nextWeek(now)!;

function calendar(options: { verifiedAt?: number; validUntil?: number; exceptions?: [string, CalendarException][] } = {}) {
  return new MarketCalendar({
    version: "fixture-v1",
    coverage: { start: day("2026-09-25"), endExclusive: day("2026-10-06") },
    verifiedAt: options.verifiedAt ?? now - 60_000,
    validUntil: options.validUntil ?? day("2026-10-06"),
    normalHours: { openingMinute: 565, closingMinute: 900 },
    exceptions: new Map((options.exceptions ?? []).map(([date, exception]) => [day(date), exception])),
    regularWeekdays: new Set([2, 3, 4, 5, 6]),
  });
}

const SECURITIES = [
  { id: "A", issuerID: "issuer-A", isEquity: true },
  { id: "B", issuerID: "issuer-B", isEquity: true },
  { id: "C", issuerID: "issuer-A", isEquity: false },
  { id: "D", issuerID: "issuer-D", isEquity: true },
];

const context = (held: string[] = [], watched: string[] = [], hidesPersonalValues = false): WeekContext => ({
  now,
  period,
  heldIDs: new Set(held),
  watchedIDs: new Set(watched),
  securities: SECURITIES,
  hidesPersonalValues,
});
const batch = (events: MarketEvent[]) => ({ events, fetchedAt: now });
const selection = (events: MarketEvent[], held: string[] = [], watched: string[] = [], previous: MarketEvent[] = []) =>
  selectWeek(batch(events), context(held, watched), previous);

function event(id: string, date = "2026-09-28"): MarketEvent {
  return {
    id,
    kind: "dividend",
    title: `Pagamento anunciado · ${id}`,
    timing: { kind: "day", day: date },
    issuer: { id: `issuer-${id}`, name: `Emitente ${id}` },
    relatedSecurityIDs: [id],
    status: "confirmed",
    importance: "issuerSpecific",
    updatedAt: now - 60_000,
    sources: [{ dataset: "issuer_dividends", recordID: id, name: "Emitente", url: "https://issuer.ao/notice", publishedAt: { kind: "day", day: "2026-09-25" }, retrievedAt: now }],
    metadata: { kind: "dividend", fiscalYear: 2025, milestone: "payment" },
  };
}

function replacing(
  base: MarketEvent,
  changes: { id?: string; timing?: EventTiming; status?: MarketEvent["status"]; updatedAt?: number; sourceURL?: string; sources?: EventSource[]; relatedIDs?: string[] },
): MarketEvent {
  return {
    ...base,
    id: changes.id ?? base.id,
    timing: changes.timing ?? base.timing,
    status: changes.status ?? base.status,
    updatedAt: changes.updatedAt ?? base.updatedAt,
    relatedSecurityIDs: changes.relatedIDs ?? base.relatedSecurityIDs,
    sources: changes.sources ?? base.sources.map((source) => ({ ...source, url: changes.sourceURL ?? source.url })),
  };
}

const dividendRow = (dates: { record?: string | null; ex?: string | null; payment?: string | null } = {}) => ({
  id: "00000000-0000-0000-0000-000000000001",
  issuer_id: "00000000-0000-0000-0000-000000000002",
  fiscal_year: 2025,
  record_date: dates.record === undefined ? "2026-09-28" : dates.record,
  ex_dividend_date: dates.ex === undefined ? "2026-09-29" : dates.ex,
  payment_date: dates.payment === undefined ? "2026-10-02" : dates.payment,
  source_url: "https://issuer.ao/notice.pdf",
  updated_at: "2026-09-27T09:59:00Z",
  issuers: { id: "00000000-0000-0000-0000-000000000002", name: "Emitente" },
});

describe("week ahead", () => {
  it("offers Home only on a known non-trading Sunday with content", () => {
    const selected = selection([event("A")]);
    expect(weekAheadOffer(selected, period, now, calendar(), now)?.destinationID).toBe("2026-09-28");
    expect(weekAheadOffer(selection([]), period, now, calendar(), now)).toBeNull();
    expect(isWeekAheadSunday(now, undefined)).toBe(false);
    expect(isWeekAheadSunday(now + 3_600_000, calendar({ validUntil: now }))).toBe(false);
    for (const date of ["2026-09-26T11:00:00+01:00", "2026-09-28T11:00:00+01:00"]) expect(isWeekAheadSunday(instant(date), calendar())).toBe(false);
    expect(isWeekAheadSunday(now, calendar({ exceptions: [["2026-09-27", { kind: "session", hours: { openingMinute: 565, closingMinute: 900 } }]] }))).toBe(false);
    for (const exception of [{ kind: "closed" }, { kind: "holiday" }] as const) {
      expect(weekAheadOffer(selected, period, now, calendar({ exceptions: [["2026-09-27", exception]] }), now)?.destinationID).toBe("2026-09-28");
    }
  });

  it("ranks portfolio, then watchlist, then market, in chronological days", () => {
    const events = [event("D", "2026-09-28"), event("B", "2026-09-29"), event("A", "2026-10-02")];
    const selected = selection(events, ["A"], ["A", "B"]);
    expect(selected.ranked.map((item) => item.id)).toEqual(["A", "B", "D"]);
    expect([selected.portfolioCount, selected.watchlistCount]).toEqual([1, 1]);
    expect(selected.days.map((entry) => entry.id)).toEqual(["2026-09-28", "2026-09-29", "2026-10-02"]);
    expect(text.summary(selected)).toContain("carteira");
    expect(text.summary(selection([event("B")], [], ["B"]))).toContain("lista");
    expect(selection(events).ranked.map((item) => item.relationship)).toEqual(["market", "market", "market"]);
  });

  it("merges duplicate provenance with stable ties", () => {
    const first = event("A");
    const second = replacing(first, { id: "other-A", sourceURL: "https://issuer.ao/another-source" });
    const selected = selection([second, first, first, event("B")]);
    expect(selected.ranked).toHaveLength(2);
    expect(selected.ranked[0].event.sources).toHaveLength(2);
    expect(selected.ranked.map((item) => item.id)).toEqual(selection([event("B"), first, second]).ranked.map((item) => item.id));
  });

  it("replaces a changed date and marks the correction", () => {
    const first = event("A", "2026-09-28");
    const revised = replacing(first, { timing: { kind: "day", day: "2026-09-30" }, updatedAt: now - 10_000 });
    const selected = selection([first, revised], [], [], [first]);
    expect(selected.ranked).toHaveLength(1);
    expect(selected.days.map((entry) => entry.id)).toEqual(["2026-09-30"]);
    expect(selected.ranked[0].isDateCorrection).toBe(true);
    const movedOut = replacing(first, { timing: { kind: "day", day: "2026-10-05" }, updatedAt: now - 10_000 });
    expect(selection([first, movedOut]).ranked).toHaveLength(0);
    expect(selection([]).ranked).toHaveLength(0);
  });

  it("lets a newer cancellation suppress older copies, and withholds conflicting claims", () => {
    const original = event("A");
    const cancelled = replacing(original, { status: "cancelled", updatedAt: now - 10_000 });
    expect(selection([cancelled, original]).ranked).toHaveLength(0);
    expect(selection([original, cancelled]).ranked).toHaveLength(0);
    expect(selection([original, replacing(original, { timing: { kind: "day", day: "2026-09-30" } })]).ranked).toHaveLength(0);
  });

  it("keeps tentative dates explicit, after confirmed ones of equal relationship", () => {
    const tentative = replacing(event("A"), { status: "tentative" });
    const selected = selection([tentative, event("B")]);
    expect(selected.ranked.map((item) => item.id)).toEqual(["B", "A"]);
    expect(selected.ranked.at(-1)?.event.status).toBe("tentative");
    expect(text.status("tentative")).toContain("provisória");
  });

  it("uses Luanda days, not UTC weekdays", () => {
    const localSunday = instant("2026-09-26T23:30:00Z");
    expect(isWeekAheadSunday(localSunday, calendar({ verifiedAt: localSunday }))).toBe(true);
    expect(nextWeek(localSunday)?.id).toBe("2026-09-28");
    const localMonday = instant("2026-09-27T23:00:00Z");
    expect(isWeekAheadSunday(localMonday, calendar())).toBe(false);
    expect(nextWeek(localMonday)?.id).toBe("2026-10-05");
    expect(selection([replacing(event("A"), { timing: { kind: "instant", at: instant("2026-10-01T23:30:00Z") } })]).days[0]?.id).toBe("2026-10-02");
    expect(selection([replacing(event("A"), { timing: { kind: "instant", at: instant("2026-10-02T23:00:00Z") } })]).days[0]?.id).toBe("2026-10-03");
  });

  it("keeps an announced date on a holiday and notes the verified closure", () => {
    const closedDays = new Set(verifiedClosures(calendar({ exceptions: [["2026-09-29", { kind: "holiday" }]] }), period, now));
    const selected = selectWeek(batch([event("A", "2026-09-29")]), { ...context(), closedDays });
    expect(selected.days.map((entry) => entry.id)).toEqual(["2026-09-29"]);
    expect(selected.days[0].hasVerifiedClosure).toBe(true);
    expect(selection([event("A")]).days[0].hasVerifiedClosure).toBe(false);
  });

  it("withholds the week when the calendar cannot vouch for it", () => {
    expect(verifiedClosures(undefined, period, now)).toBeNull();
    expect(verifiedClosures(calendar({ validUntil: now }), period, now)).toBeNull();
    expect(verifiedClosures(calendar(), nextWeek(day("2026-10-05"))!, now)).toBeNull();
    expect(verifiedClosures(calendar(), period, now)).toEqual(["2026-10-03", "2026-10-04"]);
  });

  it("lists a spanning event once with its full range", () => {
    const timing: EventTiming = { kind: "days", start: "2026-09-25", endInclusive: "2026-09-30" };
    const selected = selection([replacing(event("A"), { timing })]);
    expect(selected.days.map((entry) => entry.id)).toEqual(["2026-09-28"]);
    expect(selected.ranked[0].event.timing).toEqual(timing);
    expect(text.timing(selected.ranked[0].event)).toContain("25");
    expect(isValidTiming({ kind: "days", start: "2026-09-30", endInclusive: "2026-09-28" })).toBe(false);
    expect(overlaps({ kind: "interval", start: instant("2026-09-25T09:00:00+01:00"), endExclusive: period.interval.start }, period.interval, now)).toBe(false);
  });

  it("never invents a missing or impossible date", () => {
    expect(eventDay("2026-09-28")).toBe("2026-09-28");
    expect(eventDay("2026-02-30")).toBeUndefined();
    expect(eventDay("28/09/2026")).toBeUndefined();
    expect(dividendEvents(dividendRow({ record: null, ex: null, payment: null }), now)).toEqual([]);
    expect(dividendEvents(dividendRow({ record: null, ex: null, payment: "2026-02-30" }), now)).toEqual([]);
    expect(text.timing(event("A"))).toContain("Hora não anunciada");
  });

  it("keeps the dividend source's provenance and never infers its publication date", () => {
    const rows = dividendEvents(dividendRow(), now);
    expect(rows).toHaveLength(3);
    const payment = rows.find((row) => row.id.endsWith(":payment"))!;
    expect(payment.timing).toEqual({ kind: "day", day: "2026-10-02" });
    expect(payment.sources[0].recordID).toBe("00000000-0000-0000-0000-000000000001");
    expect(payment.sources[0].url).toBe("https://issuer.ao/notice.pdf");
    expect(payment.sources[0].publishedAt).toBeUndefined();
    expect(text.publication(payment.sources[0])).toContain("não disponibilizada");
    expect(payment.updatedAt).toBe(now - 60_000);
    expect(hasValidProvenance(payment, now)).toBe(true);
  });

  it("fails closed on unsafe sources, future publication and stale batches", () => {
    expect(selection([replacing(event("A"), { sourceURL: "http://issuer.ao/notice" })]).ranked).toHaveLength(0);
    const future: EventSource = { dataset: "issuer_dividends", recordID: "A", name: "Emitente", url: "https://issuer.ao/notice", publishedAt: { kind: "day", day: "2026-09-28" }, retrievedAt: now };
    expect(selection([replacing(event("A"), { sources: [future] })]).ranked).toHaveLength(0);
    expect(selectWeek({ events: [event("A")], fetchedAt: now - 300_000 }, context()).ranked).toHaveLength(0);
    expect(selectWeek({ events: [event("A")], fetchedAt: now + 1_000 }, context()).ranked).toHaveLength(0);
  });

  it("links issuer dividends to equities only; privacy removes every relationship", () => {
    const selected = selection([replacing(event("A"), { relatedIDs: [] })], ["C"]);
    expect(selected.portfolioCount).toBe(0);
    expect(selected.ranked[0].event.relatedSecurityIDs).toEqual(["A"]);
    const hidden = selectWeek(batch([event("A"), event("B")]), context(["A"], ["B"], true));
    expect([hidden.portfolioCount, hidden.watchlistCount]).toEqual([0, 0]);
    expect(text.summary(hidden)).not.toContain("carteira");
    expect(text.summary(hidden)).not.toContain("lista");
  });

  it("never turns unsupported kinds into live content", () => {
    const kinds: EventKind[] = ["coupon", "bondMaturity", "corporateAnnouncement", "financialResults", "companyMeeting", "marketSchedule", "economicRelease"];
    for (const kind of kinds) {
      expect(selection([{ ...event("A"), kind, importance: "marketWide", metadata: undefined }]).ranked, kind).toHaveLength(0);
    }
  });

  it("replays a kept batch for a day, labelled as cached", () => {
    const fetchedAt = now - 10 * 60_000;
    const read = replacing(event("A"), { updatedAt: fetchedAt - 60_000 });
    const kept = { events: [{ ...read, sources: read.sources.map((source) => ({ ...source, retrievedAt: fetchedAt })) }], fetchedAt, isCached: true };
    const later = { ...context(), now };
    expect(selectWeek(kept, later).ranked).toHaveLength(1);
    expect(selectWeek({ ...kept, fetchedAt: now - 25 * 3_600_000 }, later).ranked).toHaveLength(0);
  });
});
