import { MarketCalendar, type Period } from "@/domain/market/calendar";
import { type EpochMs, DAY_MS, MINUTE_MS, addDays, civilDate, dayStart, parseInstant, weekday } from "@/domain/market/zone";

/*
 * Semana à frente (iOS `WeekAheadPolicy`, `MarketEvent`, `SupabaseMarketEventRepository`): dates already announced
 * by a named source for the next civil week in Luanda. No forecast, no inferred date, no entitlement.
 */

/** A strict `YYYY-MM-DD` Luanda calendar day. */
export type EventDay = string;

export type EventTiming =
  | { readonly kind: "day"; readonly day: EventDay }
  | { readonly kind: "instant"; readonly at: EpochMs }
  | { readonly kind: "days"; readonly start: EventDay; readonly endInclusive: EventDay }
  | { readonly kind: "interval"; readonly start: EpochMs; readonly endExclusive: EpochMs };

export type EventKind =
  | "newListing"
  | "dividend"
  | "coupon"
  | "bondMaturity"
  | "corporateAnnouncement"
  | "financialResults"
  | "companyMeeting"
  | "marketSchedule"
  | "economicRelease";
export type EventStatus = "confirmed" | "tentative" | "cancelled";
export type EventImportance = "issuerSpecific" | "marketWide";
export type DividendMilestone = "record" | "exDividend" | "payment";
export type PublicationDate = { readonly kind: "day"; readonly day: EventDay } | { readonly kind: "instant"; readonly at: EpochMs };

export interface EventSource {
  readonly dataset: string;
  readonly recordID: string;
  readonly name: string;
  readonly url: string;
  /** Absent is explicitly unknown; an ingestion or update time never replaces it. */
  readonly publishedAt?: PublicationDate;
  readonly retrievedAt: EpochMs;
}

export interface MarketEvent {
  readonly id: string;
  readonly kind: EventKind;
  readonly title: string;
  readonly timing: EventTiming;
  readonly issuer?: { readonly id: string; readonly name: string };
  readonly relatedSecurityIDs: readonly string[];
  readonly status: EventStatus;
  readonly importance: EventImportance;
  readonly updatedAt: EpochMs;
  readonly sources: readonly EventSource[];
  readonly metadata?: { readonly kind: "dividend"; readonly fiscalYear: number; readonly milestone: DividendMilestone };
}

export interface EventBatch {
  readonly events: readonly MarketEvent[];
  readonly fetchedAt: EpochMs;
  /** A batch kept from an earlier read, replayed after a failed refresh. */
  readonly isCached?: boolean;
}

/** Source reads stay current for five minutes; a kept batch replays for a day. */
export const MAXIMUM_EVENT_AGE = 5 * MINUTE_MS;
export const REPLAY_AGE = DAY_MS;

const finite = (value: EpochMs) => Number.isFinite(value);
export const isFreshBatch = (batch: EventBatch, now: EpochMs) =>
  finite(batch.fetchedAt) && finite(now) && batch.fetchedAt <= now && now < batch.fetchedAt + MAXIMUM_EVENT_AGE;
export const isReplayableBatch = (batch: EventBatch, now: EpochMs) =>
  finite(batch.fetchedAt) && finite(now) && batch.fetchedAt <= now && now < batch.fetchedAt + REPLAY_AGE;

// MARK: Days and periods

/** A day only when the text is a real `YYYY-MM-DD` calendar day. */
export const eventDay = (value: unknown): EventDay | undefined =>
  typeof value === "string" && value.length === 10 && dayStart(value) !== undefined ? value : undefined;

const startOf = (day: EventDay) => dayStart(day)!;
const nextDay = (day: EventDay) => civilDate(addDays(startOf(day), 1));

export interface WeekPeriod {
  /** The Monday, `YYYY-MM-DD`: the destination id. */
  readonly id: EventDay;
  readonly interval: Period;
}

/** The civil week after the one containing `now`: on a Monday, the following Monday. */
export function nextWeek(now: EpochMs): WeekPeriod | undefined {
  const week = MarketCalendar.week(now);
  if (!week) return undefined;
  return { id: civilDate(week.endExclusive), interval: { start: week.endExclusive, endExclusive: addDays(week.endExclusive, 7) } };
}

const isValidWeek = (period: WeekPeriod) =>
  MarketCalendar.week(period.interval.start)?.start === period.interval.start &&
  period.interval.endExclusive === addDays(period.interval.start, 7) &&
  civilDate(period.interval.start) === period.id;

/** The week's last civil day (Sunday), for the range label. */
export const lastDay = (period: WeekPeriod): EventDay => civilDate(period.interval.endExclusive - DAY_MS);

// MARK: Timing

export const timingStart = (timing: EventTiming): EpochMs =>
  timing.kind === "day" ? startOf(timing.day) : timing.kind === "days" ? startOf(timing.start) : timing.kind === "instant" ? timing.at : timing.start;

export function isValidTiming(timing: EventTiming): boolean {
  switch (timing.kind) {
    case "day":
      return eventDay(timing.day) !== undefined;
    case "instant":
      return finite(timing.at);
    case "days":
      return eventDay(timing.start) !== undefined && eventDay(timing.endInclusive) !== undefined && timing.start <= timing.endInclusive;
    case "interval":
      return finite(timing.start) && finite(timing.endExclusive) && timing.start < timing.endExclusive;
  }
}

/** Whether the timing still touches `period` from `now` on; an exclusive end never reaches the next week. */
export function overlaps(timing: EventTiming, period: Period, now: EpochMs): boolean {
  if (!isValidTiming(timing) || !(period.start < period.endExclusive) || !finite(now)) return false;
  const from = Math.max(period.start, now);
  switch (timing.kind) {
    case "instant":
      return timing.at >= period.start && timing.at < period.endExclusive && timing.at >= now;
    case "day":
      return startOf(timing.day) < period.endExclusive && startOf(nextDay(timing.day)) > from;
    case "days":
      return startOf(timing.start) < period.endExclusive && startOf(nextDay(timing.endInclusive)) > from;
    case "interval":
      return timing.start < period.endExclusive && timing.endExclusive > from;
  }
}

const sameTiming = (a: EventTiming, b: EventTiming) => JSON.stringify(timingKey(a)) === JSON.stringify(timingKey(b));
const timingKey = (timing: EventTiming) =>
  timing.kind === "day"
    ? [timing.kind, timing.day]
    : timing.kind === "instant"
      ? [timing.kind, timing.at]
      : timing.kind === "days"
        ? [timing.kind, timing.start, timing.endInclusive]
        : [timing.kind, timing.start, timing.endExclusive];

// MARK: Provenance

export function semanticKey(event: MarketEvent): string {
  if (event.kind === "dividend" && event.metadata?.kind === "dividend" && event.issuer) {
    return `dividend:${event.issuer.id.length}:${event.issuer.id}:${event.metadata.fiscalYear}:${event.metadata.milestone}`;
  }
  return `event:${event.id}`;
}

/** An `https` address with a host and no credentials, as given; otherwise undefined. */
export function safeSourceURL(value: unknown): URL | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "" && url.username === "" && url.password === "" ? url : undefined;
  } catch {
    return undefined;
  }
}

const publicationInstant = (date: PublicationDate) => (date.kind === "day" ? (dayStart(date.day) ?? Number.NaN) : date.at);

/** iOS `MarketEventValidator`: unsafe, future-dated or stale provenance withholds the event. */
export function hasValidProvenance(event: MarketEvent, now: EpochMs): boolean {
  if (
    event.id === "" ||
    event.title.trim() === "" ||
    !isValidTiming(event.timing) ||
    !finite(now) ||
    !finite(event.updatedAt) ||
    event.updatedAt > now
  ) {
    return false;
  }
  const sourcesValid =
    event.sources.length > 0 &&
    event.sources.every(
      (source) =>
        source.dataset !== "" &&
        source.recordID !== "" &&
        source.name !== "" &&
        safeSourceURL(source.url) !== undefined &&
        finite(source.retrievedAt) &&
        source.retrievedAt <= now &&
        event.updatedAt <= source.retrievedAt &&
        (source.publishedAt === undefined ||
          (finite(publicationInstant(source.publishedAt)) && publicationInstant(source.publishedAt) <= source.retrievedAt)),
    );
  if (!sourcesValid) return false;
  if (!event.sources.every((source) => now - source.retrievedAt < MAXIMUM_EVENT_AGE)) return false;
  return event.importance !== "issuerSpecific" || (event.issuer !== undefined && event.issuer.id !== "" && event.issuer.name.trim() !== "");
}

const sourceSortKey = (source: EventSource) => `${source.dataset}:${source.recordID}:${source.url}`;
const sameSource = (a: EventSource, b: EventSource) =>
  a.dataset === b.dataset &&
  a.recordID === b.recordID &&
  a.name === b.name &&
  a.url === b.url &&
  a.retrievedAt === b.retrievedAt &&
  JSON.stringify(a.publishedAt ?? null) === JSON.stringify(b.publishedAt ?? null);

const sameClaim = (a: MarketEvent, b: MarketEvent) =>
  a.kind === b.kind &&
  a.title === b.title &&
  sameTiming(a.timing, b.timing) &&
  JSON.stringify(a.issuer ?? null) === JSON.stringify(b.issuer ?? null) &&
  a.status === b.status &&
  JSON.stringify(a.metadata ?? null) === JSON.stringify(b.metadata ?? null) &&
  [...a.relatedSecurityIDs].sort().join("\u0000") === [...b.relatedSecurityIDs].sort().join("\u0000") &&
  a.importance === b.importance;

const byID = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The newest revision of each semantic event, before any period filter, so an old date cannot come back. Equal
 * copies merge their sources; conflicting claims at the same revision are withheld.
 */
export function currentVersions(events: readonly MarketEvent[]): MarketEvent[] {
  const groups = new Map<string, MarketEvent[]>();
  for (const event of events) groups.set(semanticKey(event), [...(groups.get(semanticKey(event)) ?? []), event]);
  const result: MarketEvent[] = [];
  for (const copies of groups.values()) {
    const revisions = copies.map((copy) => copy.updatedAt).filter(finite);
    if (revisions.length === 0) continue;
    const latest = Math.max(...revisions);
    const versions = copies.filter((copy) => copy.updatedAt === latest).sort(byID);
    const chosen = versions[0];
    if (!versions.every((version) => sameClaim(version, chosen))) continue;
    const sources: EventSource[] = [];
    for (const source of versions.flatMap((version) => version.sources)) {
      if (!sources.some((kept) => sameSource(kept, source))) sources.push(source);
    }
    sources.sort((a, b) => (sourceSortKey(a) < sourceSortKey(b) ? -1 : sourceSortKey(a) > sourceSortKey(b) ? 1 : 0));
    result.push({ ...chosen, sources });
  }
  return result.sort(byID);
}

// MARK: Selection

export type Relationship = "portfolio" | "watchlist" | "market";
const RELATIONSHIP_RANK: Record<Relationship, number> = { portfolio: 0, watchlist: 1, market: 2 };

export interface WeekSecurity {
  readonly id: string;
  readonly issuerID?: string;
  readonly isEquity: boolean;
}

export interface WeekContext {
  readonly now: EpochMs;
  readonly period: WeekPeriod;
  readonly heldIDs: ReadonlySet<string>;
  readonly watchedIDs: ReadonlySet<string>;
  readonly securities: readonly WeekSecurity[];
  /** Privacy mode: no relationship is disclosed. */
  readonly hidesPersonalValues: boolean;
  /** Days of the week the verified calendar shows without a session. */
  readonly closedDays?: ReadonlySet<EventDay>;
}

export interface WeekItem {
  readonly id: string;
  readonly event: MarketEvent;
  readonly relationship: Relationship;
  /** The date changed since the batch this tab saw before. */
  readonly isDateCorrection: boolean;
}

export interface WeekDay {
  readonly id: EventDay;
  readonly items: readonly WeekItem[];
  readonly hasVerifiedClosure: boolean;
}

export interface WeekSelection {
  readonly ranked: readonly WeekItem[];
  readonly days: readonly WeekDay[];
  readonly expiresAt: EpochMs;
  readonly portfolioCount: number;
  readonly watchlistCount: number;
}

const selectionOf = (ranked: WeekItem[], days: WeekDay[], expiresAt: EpochMs): WeekSelection => ({
  ranked,
  days,
  expiresAt,
  portfolioCount: ranked.filter((item) => item.relationship === "portfolio").length,
  watchlistCount: ranked.filter((item) => item.relationship === "watchlist").length,
});

/**
 * Ordering (product §2.4, `docs/week-ahead-phase7.md`): portfolio, watchlist, market; market-wide first; confirmed
 * before tentative; chronological; id. Browsing behaviour never takes part.
 */
function compareItems(a: WeekItem, b: WeekItem): number {
  return (
    RELATIONSHIP_RANK[a.relationship] - RELATIONSHIP_RANK[b.relationship] ||
    Number(b.event.importance === "marketWide") - Number(a.event.importance === "marketWide") ||
    Number(a.event.status !== "confirmed") - Number(b.event.status !== "confirmed") ||
    timingStart(a.event.timing) - timingStart(b.event.timing) ||
    byID(a, b)
  );
}

/** The week's events for this viewer. `previous` is the batch seen before, for the date-correction badge. */
export function selectWeek(batch: EventBatch, context: WeekContext, previous: readonly MarketEvent[] = []): WeekSelection {
  const cached = batch.isCached === true;
  const expiresAt = batch.fetchedAt + (cached ? REPLAY_AGE : MAXIMUM_EVENT_AGE);
  const validationTime = cached ? batch.fetchedAt : context.now;
  const usable = cached ? isReplayableBatch(batch, context.now) : isFreshBatch(batch, context.now);
  if (!isValidWeek(context.period) || !usable) return selectionOf([], [], expiresAt);

  const available = new Set(context.securities.map((security) => security.id));
  const equities = new Set(context.securities.filter((security) => security.isEquity).map((security) => security.id));
  const held = context.hidesPersonalValues ? new Set<string>() : context.heldIDs;
  const watched = context.hidesPersonalValues ? new Set<string>() : context.watchedIDs;
  const older = new Map<string, MarketEvent>();
  for (const event of previous) {
    const kept = older.get(semanticKey(event));
    if (!kept || event.updatedAt > kept.updatedAt) older.set(semanticKey(event), event);
  }

  const items: WeekItem[] = [];
  for (const event of currentVersions(batch.events)) {
    // Only the dividend source exists today; other kinds never become live content by accident.
    if (
      event.kind !== "dividend" ||
      event.status === "cancelled" ||
      !hasValidProvenance(event, validationTime) ||
      !event.sources.every((source) => validationTime - source.retrievedAt < MAXIMUM_EVENT_AGE) ||
      !overlaps(event.timing, context.period.interval, context.now)
    ) {
      continue;
    }
    const related =
      event.relatedSecurityIDs.length === 0
        ? context.securities.filter((security) => security.isEquity && event.issuer && security.issuerID === event.issuer.id).map((security) => security.id)
        : event.relatedSecurityIDs.filter((id) => available.has(id));
    // A dividend never personalises a bond of the same issuer.
    const assets = [...new Set(related)].filter((id) => equities.has(id)).sort();
    const relationship: Relationship = assets.some((id) => held.has(id)) ? "portfolio" : assets.some((id) => watched.has(id)) ? "watchlist" : "market";
    const before = older.get(semanticKey(event));
    const isDateCorrection = before !== undefined && before.updatedAt < event.updatedAt && !sameTiming(before.timing, event.timing);
    items.push({ id: event.id, event: { ...event, relatedSecurityIDs: assets }, relationship, isDateCorrection });
  }

  const ranked = items.sort(compareItems);
  const order = new Map(ranked.map((item, index) => [item.id, index]));
  const grouped = new Map<EventDay, WeekItem[]>();
  for (const item of ranked) {
    // A spanning event is listed once, on its first day inside the week, with its whole range shown.
    const day = civilDate(Math.max(timingStart(item.event.timing), context.period.interval.start));
    grouped.set(day, [...(grouped.get(day) ?? []), item]);
  }
  const days = [...grouped.entries()]
    .map(([id, dayItems]) => ({
      id,
      items: dayItems.sort((a, b) => timingStart(a.event.timing) - timingStart(b.event.timing) || order.get(a.id)! - order.get(b.id)!),
      hasVerifiedClosure: context.closedDays?.has(id) === true,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  return selectionOf(ranked, days, expiresAt);
}

/**
 * The week's verified sessionless days, or null when the calendar cannot vouch for the whole week (no calendar,
 * outside coverage, or past its deadline). Null withholds the agenda.
 */
export function verifiedClosures(calendar: MarketCalendar | undefined, period: WeekPeriod, now: EpochMs): EventDay[] | null {
  if (!calendar || calendar.sessions(period.interval, now) === undefined) return null;
  const closed: EventDay[] = [];
  for (let day = period.interval.start; day < period.interval.endExclusive; day = addDays(day, 1)) {
    if (calendar.sessions({ start: day, endExclusive: addDays(day, 1) }, now)?.length === 0) closed.push(civilDate(day));
  }
  return closed;
}

/** Sunday in Luanda with a known non-trading state: the only day Home may offer the week ahead. */
export function isWeekAheadSunday(now: EpochMs, calendar: MarketCalendar | undefined): boolean {
  if (!finite(now) || weekday(now) !== 1 || !calendar) return false;
  return ["weekend", "closed", "holiday"].includes(calendar.state(now));
}

/** The Home offer's destination and deadline, or null when Home must not show it. */
export function weekAheadOffer(
  selection: WeekSelection,
  period: WeekPeriod,
  availableAt: EpochMs,
  calendar: MarketCalendar | undefined,
  now: EpochMs,
): { destinationID: EventDay; expiresAt: EpochMs } | null {
  if (
    !isWeekAheadSunday(now, calendar) ||
    nextWeek(now)?.id !== period.id ||
    !finite(availableAt) ||
    availableAt > now ||
    now >= selection.expiresAt ||
    selection.ranked.length === 0
  ) {
    return null;
  }
  return { destinationID: period.id, expiresAt: Math.min(selection.expiresAt, period.interval.start) };
}

// MARK: Dividend source

/** Message keys of the three dividend milestones, in display order. */
export const MILESTONE_TITLE_KEYS: Record<DividendMilestone, string> = {
  record: "market.event.dividendRecordDate",
  exDividend: "market.event.exDividendDate",
  payment: "market.event.dividendPayment",
};

/** The columns `dividendEvents` reads from `issuer_dividends` (public, RLS-protected). */
export const DIVIDEND_EVENT_COLUMNS = "id,issuer_id,fiscal_year,record_date,ex_dividend_date,payment_date,source_url,updated_at,issuers(id,name)";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One event per milestone the row states explicitly (iOS `SupabaseMarketEventRepository.events`). Nothing is
 * inferred: no missing date, amount, entitlement or publication date.
 */
export function dividendEvents(row: unknown, fetchedAt: EpochMs): MarketEvent[] {
  if (typeof row !== "object" || row === null) return [];
  const value = row as Record<string, unknown>;
  const issuer = value.issuers as Record<string, unknown> | null | undefined;
  const url = safeSourceURL(value.source_url);
  const updated = typeof value.updated_at === "string" ? parseInstant(value.updated_at) : undefined;
  if (
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    typeof value.issuer_id !== "string" ||
    !UUID.test(value.issuer_id) ||
    typeof issuer !== "object" ||
    issuer === null ||
    issuer.id !== value.issuer_id ||
    typeof issuer.name !== "string" ||
    issuer.name.trim() === "" ||
    typeof value.fiscal_year !== "number" ||
    !Number.isInteger(value.fiscal_year) ||
    value.fiscal_year < 1900 ||
    !url ||
    updated === undefined ||
    updated > fetchedAt
  ) {
    return [];
  }
  const source: EventSource = { dataset: "issuer_dividends", recordID: value.id, name: url.hostname, url: String(value.source_url), retrievedAt: fetchedAt };
  const milestones: [DividendMilestone, unknown][] = [
    ["record", value.record_date],
    ["exDividend", value.ex_dividend_date],
    ["payment", value.payment_date],
  ];
  return milestones.flatMap(([milestone, raw]) => {
    const day = eventDay(raw);
    if (!day) return [];
    return [
      {
        id: `dividend:${value.id}:${milestone}`,
        kind: "dividend",
        title: `${milestone} · ${issuer.name}`,
        timing: { kind: "day", day },
        issuer: { id: value.issuer_id as string, name: issuer.name as string },
        relatedSecurityIDs: [],
        status: "confirmed",
        importance: "issuerSpecific",
        updatedAt: updated,
        sources: [source],
        metadata: { kind: "dividend", fiscalYear: value.fiscal_year as number, milestone },
      } satisfies MarketEvent,
    ];
  });
}

/** Local midnight of `day`. */
export const dayInstant = (day: EventDay) => startOf(day);
