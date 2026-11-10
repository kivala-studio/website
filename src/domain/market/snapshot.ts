import type { MarketCalendar, MarketState } from "./calendar";
import { visibleOutsideSearch } from "./classification";
import {
  type DataAvailabilityState,
  type HomeMarketSummary,
  type MarketDataAvailability,
  type MarketSnapshot,
  type MarketSourceMetadata,
  type MarketStatus,
  availabilityCoverage,
  summaryCoverage,
  validatedCoverage,
} from "./models";
import {
  type DataQualityReport,
  VALID_QUALITY,
  invalidated,
  permitsCurrentUse,
  permitsInsight,
  permitsUse,
  qualityFailure,
} from "./quality";
import { displayPrice, hasSessionQuote, hasUsableQuote, usesReferenceDisplayPrice } from "./quote-policy";
import { type EpochMs, SECOND_MS, dayStart, isSameDay } from "./zone";

/** The displayed status is always recomputed from the calendar; the server's status string is never shown. */
export function marketStatusFor(state: MarketState): MarketStatus {
  switch (state) {
    case "open":
      return "open";
    case "preMarket":
      return "openingSoon";
    case "unknown":
      return "unknown";
    default:
      return "closed";
  }
}

const expire = (report: DataQualityReport, now: EpochMs) =>
  permitsInsight(report) && !permitsUse(report, now) ? invalidated(report, "stale", "staleFetch") : report;

/**
 * Re-evaluates every quote against the calendar and the clock. Expired evidence is downgraded locally
 * to `stale/staleFetch`; with `permitsQuotes = false` every current quote, book and total is revoked.
 */
export function applyCurrentQuotePolicy(
  snapshot: MarketSnapshot,
  calendar: MarketCalendar | undefined,
  now: EpochMs,
  permitsQuotes = true,
): MarketSnapshot {
  const status = marketStatusFor(calendar?.state(now) ?? "unknown");
  const deadline = calendar?.nextTransition(now);
  const securities = snapshot.securities.map((security) => {
    let quoteQuality = security.quoteQuality && expire(security.quoteQuality, now);
    let orderBookQuality = security.orderBookQuality && expire(security.orderBookQuality, now);
    if (!permitsQuotes) {
      quoteQuality = invalidated(quoteQuality ?? VALID_QUALITY, "stale", "staleFetch");
      orderBookQuality = invalidated(orderBookQuality ?? VALID_QUALITY, "stale", "staleFetch");
    }
    return { ...security, marketStatus: status, marketContextValidUntil: deadline, quoteQuality, orderBookQuality };
  });
  const statistics = snapshot.statisticsQuality;
  const statisticsQuality = permitsQuotes
    ? statistics && expire(statistics, now)
    : statistics
      ? invalidated(statistics, "stale", "staleFetch")
      : qualityFailure("stale", "staleFetch");
  return { ...snapshot, status, securities, statisticsQuality, marketContextValidUntil: deadline };
}

/** Why current quotes are withdrawn without a network call. */
export type QuoteRevocation = "hidden" | "offline" | "refreshFailed";

/** The first condition that forbids showing anything as current, if any. */
export function quoteRevocation(context: {
  hidden: boolean;
  online: boolean;
  lastRefreshFailed: boolean;
}): QuoteRevocation | undefined {
  if (context.hidden) return "hidden";
  if (!context.online) return "offline";
  return context.lastRefreshFailed ? "refreshFailed" : undefined;
}

/**
 * Hidden tab, lost connection or failed refresh: keep what is on screen as dated evidence
 * (closes, references, last reported prices) but nothing stays current.
 */
export const revokeCurrentQuotes = (snapshot: MarketSnapshot, calendar: MarketCalendar | undefined, now: EpochMs) =>
  applyCurrentQuotePolicy(snapshot, calendar, now, false);

const finite = (values: readonly (number | undefined)[]) =>
  values.filter((value): value is number => value !== undefined && Number.isFinite(value));

/** Every instant at which a displayed quote changes eligibility, ascending and unique. */
export function currentQuoteDeadlines(snapshot: MarketSnapshot): EpochMs[] {
  const dates = snapshot.securities.flatMap((security) =>
    finite([
      security.quoteQuality?.validUntilEpoch === undefined ? undefined : security.quoteQuality.validUntilEpoch * SECOND_MS,
      security.marketContextValidUntil,
    ]),
  );
  return [...new Set(dates)].sort((a, b) => a - b);
}

export const currentQuoteDeadline = (snapshot: MarketSnapshot) => currentQuoteDeadlines(snapshot)[0];

export function hasUsableStatistics(snapshot: MarketSnapshot, now: EpochMs): boolean {
  const { status, statisticsQuality: quality } = snapshot;
  const context = snapshot.marketContextValidUntil;
  const tradingDate = snapshot.sourceMetadata?.tradingDate;
  return (
    status !== "unknown" &&
    context !== undefined &&
    Number.isFinite(context) &&
    now < context &&
    quality !== undefined &&
    permitsCurrentUse(quality, now, status === "open") &&
    (status !== "open" || (tradingDate !== undefined && isSameDay(tradingDate, now)))
  );
}

const latestObservation = (epochs: readonly (number | undefined)[], now: EpochMs) => {
  const seconds = finite(epochs).filter((epoch) => epoch <= now / SECOND_MS);
  return seconds.length === 0 ? undefined : Math.max(...seconds) * SECOND_MS;
};

export function dataAvailability(
  snapshot: MarketSnapshot,
  now: EpochMs,
  { isOffline = false, usesGlobalCoverage = true }: { isOffline?: boolean; usesGlobalCoverage?: boolean } = {},
): MarketDataAvailability {
  const instruments = visibleOutsideSearch(snapshot.securities, now);
  const sessionCount = instruments.filter((security) => hasSessionQuote(security, now)).length;
  const referenceCount = instruments.filter((security) => usesReferenceDisplayPrice(security, now)).length;
  const sourceAvailability = snapshot.sourceMetadata?.availability;
  const coverage =
    (usesGlobalCoverage && sourceAvailability ? availabilityCoverage(sourceAvailability) : undefined) ??
    validatedCoverage({
      session: sessionCount,
      reference: referenceCount,
      missing: instruments.length - sessionCount - referenceCount,
      active: instruments.length,
    });
  const availableCount = instruments.filter((security) => hasUsableQuote(security, now)).length;
  const sourceObservedAt = snapshot.sourceMetadata?.sourceObservedAt;
  const lastObservation = latestObservation(
    [
      sourceAvailability?.lastSuccessfulObservationAtEpoch,
      sourceObservedAt === undefined ? undefined : sourceObservedAt / SECOND_MS,
      ...instruments.map((security) => security.quoteQuality?.sourceObservedAtEpoch),
    ],
    now,
  );
  const { status } = snapshot;
  let state: DataAvailabilityState;
  if (isOffline) state = "offline";
  else if (status === "unknown" || (snapshot.marketContextValidUntil !== undefined && now >= snapshot.marketContextValidUntil)) {
    state = "unknownCalendar";
  } else if (status === "closed" || status === "openingSoon") {
    state = instruments.some((security) => displayPrice(security, now) !== undefined) ? "historical" : "unavailable";
  } else if (availableCount > 0) state = availableCount === instruments.length ? "available" : "partial";
  else if (sourceAvailability?.status === "sourceUnavailable") state = "sourceUnavailable";
  else if (
    lastObservation !== undefined ||
    instruments.some((security) => security.quoteQuality?.status === "stale" || security.quoteQuality?.status === "delayed") ||
    sourceAvailability?.status === "delayed"
  ) {
    state = "delayed";
  } else state = "unavailable";
  const coverageDate = usesGlobalCoverage && sourceAvailability?.coverageDate ? dayStart(sourceAvailability.coverageDate) : undefined;
  return {
    state,
    availableInstrumentCount: availableCount,
    totalInstrumentCount: coverage?.activeInstrumentCount ?? instruments.length,
    lastSuccessfulObservationAt: lastObservation,
    coverage,
    coverageDate,
  };
}

/** Source freshness wording; the feed is never called real-time. */
export function sourceFreshness(metadata: MarketSourceMetadata, now: EpochMs): "unknown" | "stale" | "delayed" {
  const { tradingDate, collectedAt, publishedAt, sourceObservedAt } = metadata;
  if (tradingDate === undefined || collectedAt === undefined || publishedAt === undefined) return "unknown";
  const ceiling = (sourceObservedAt === undefined ? 10 * 60 : 120) * SECOND_MS;
  if (
    !isSameDay(tradingDate, now) ||
    collectedAt > publishedAt ||
    publishedAt > now ||
    !(now - (sourceObservedAt ?? collectedAt) < ceiling)
  ) {
    return "stale";
  }
  if (
    sourceObservedAt !== undefined &&
    collectedAt <= sourceObservedAt &&
    sourceObservedAt <= now &&
    now - sourceObservedAt < 120 * SECOND_MS
  ) {
    return "delayed";
  }
  return metadata.dataStatus === "stale" ? "stale" : "delayed";
}

/** Compact Home projection. Presentation only: never a catalogue, never cached. */
export interface HomeMarketProjection {
  readonly cards: MarketSnapshot;
  readonly summary: HomeMarketSummary;
  readonly calendar: MarketCalendar;
  readonly generatedAt: EpochMs;
}

/** Instants at which the projection must be redrawn. */
export function projectionExpiryDates(projection: HomeMarketProjection): EpochMs[] {
  const { summary, cards, calendar } = projection;
  const evidence = finite([
    summary.validUntilEpoch,
    cards.statisticsQuality?.validUntilEpoch,
    ...cards.securities.map((security) => security.quoteQuality?.validUntilEpoch),
  ]).map((epoch) => epoch * SECOND_MS);
  return [...evidence, calendar.validUntil, ...finite([calendar.nextTransition(projection.generatedAt)])];
}

export const projectionSnapshot = (projection: HomeMarketProjection, now: EpochMs) =>
  applyCurrentQuotePolicy(projection.cards, projection.calendar, now);

export function projectionAvailability(
  projection: HomeMarketProjection,
  now: EpochMs,
  isOffline: boolean,
): MarketDataAvailability {
  const { summary, cards } = projection;
  const snapshot = projectionSnapshot(projection, now);
  const sourceAvailability = cards.sourceMetadata?.availability;
  const available = snapshot.status === "open" && now / SECOND_MS < summary.validUntilEpoch ? summary.availableQuoteCount : 0;
  const observation = latestObservation([summary.lastObservationEpoch, sourceAvailability?.lastSuccessfulObservationAtEpoch], now);
  let state: DataAvailabilityState;
  if (isOffline) state = "offline";
  else if (snapshot.status === "unknown") state = "unknownCalendar";
  else if (snapshot.status !== "open") state = "historical";
  else if (available > 0) state = available === summary.instrumentCount ? "available" : "partial";
  else if (sourceAvailability?.status === "sourceUnavailable") state = "sourceUnavailable";
  else if (observation !== undefined) state = "delayed";
  else state = "unavailable";
  const coverageDate = summary.coverageDate ?? sourceAvailability?.coverageDate;
  return {
    state,
    availableInstrumentCount: available,
    totalInstrumentCount: summary.instrumentCount,
    lastSuccessfulObservationAt: observation,
    coverage: summaryCoverage(summary) ?? (sourceAvailability ? availabilityCoverage(sourceAvailability) : undefined),
    coverageDate: coverageDate ? dayStart(coverageDate) : undefined,
  };
}
