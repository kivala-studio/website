import Decimal from "decimal.js";

import { type MarketCalendar, decodeMarketCalendar } from "./calendar";
import { classifySecurityKind } from "./classification";
import {
  type CurrentMarketQuotes,
  type HomeProjectionResponse,
  type MarketPriceRow,
  type MarketPulseRow,
  type MarketReferencePriceRow,
  type MarketSnapshotBundle,
  type ReferenceEvidence,
  type SecurityRow,
  type VerifiedCloseRow,
  currentRowPrice,
} from "./decode";
import { MarketDecodingError } from "./decoding-error";
import {
  EMPTY_MARKET_INDEX,
  MARKET_MESSAGE_KEYS,
  type MarketIndex,
  type MarketReferencePrice,
  type MarketSecurity,
  type MarketSnapshot,
  type MarketStatus,
  type VerifiedClosingPrice,
  summaryCoverage,
} from "./models";
import { type DataQualityReport, permitsInsight, qualityFailure, validateReportedPrice } from "./quality";
import { hasUsableQuote, isValidReference } from "./quote-policy";
import { type HomeMarketProjection, projectionSnapshot } from "./snapshot";
import { type EpochMs, SECOND_MS, dayStart, parseInstant, tradingDateNoon } from "./zone";

const ZERO = new Decimal(0);

/** Server status strings, used only until the calendar reassesses the snapshot. */
export function marketStatusFromServer(raw: string | undefined): MarketStatus {
  switch (raw?.toLowerCase()) {
    case "open":
      return "open";
    case "opening_soon":
    case "pre_open":
      return "openingSoon";
    case "closed":
      return "closed";
    default:
      return "unknown";
  }
}

/** Accepted only when positive and confirmed after its session and not in the future. */
export function verifiedClosingPrice(row: VerifiedCloseRow, now: EpochMs): VerifiedClosingPrice | undefined {
  const day = dayStart(row.tradingDate);
  const confirmedAt = parseInstant(row.confirmedAt);
  if (!row.price.isFinite() || !row.price.gt(0) || !Number.isFinite(now)) return undefined;
  if (day === undefined || confirmedAt === undefined || day > confirmedAt || confirmedAt > now) return undefined;
  const change = row.verifiedChangePercent;
  return {
    price: row.price,
    tradingDate: day,
    confirmedAt,
    percentageChange: change !== undefined && change.isFinite() && change.gt(-100) ? change : undefined,
  };
}

export function referencePrice(evidence: ReferenceEvidence | undefined, now: EpochMs): MarketReferencePrice | undefined {
  if (!evidence) return undefined;
  const { price, priceDate, tradedAt, collectedAt, sourceURL, sourceHash, parserVersion } = evidence;
  const day = priceDate === undefined || priceDate.length !== 10 ? undefined : dayStart(priceDate);
  const collected = parseInstant(collectedAt);
  const traded = parseInstant(tradedAt);
  if (price === undefined || day === undefined || collected === undefined) return undefined;
  if ((tradedAt !== undefined && traded === undefined) || sourceURL === undefined) return undefined;
  if (sourceHash === undefined || parserVersion === undefined) return undefined;
  const reference: MarketReferencePrice = {
    price,
    priceDate: day,
    tradedAt: traded,
    collectedAt: collected,
    sourceURL,
    sourceHash,
    parserVersion,
  };
  return isValidReference(reference, now) ? reference : undefined;
}

/** One security from catalogue, quote and evidence rows. Nothing here is current until the policy runs. */
export function makeSecurity(
  row: SecurityRow,
  context: {
    price?: MarketPriceRow;
    closingPrice?: VerifiedClosingPrice;
    reference?: MarketReferencePriceRow;
    /** Membership of the official active universe, when the server sent it. */
    isActive?: boolean;
    marketStatus: MarketStatus;
    now: EpochMs;
  },
): MarketSecurity {
  const { price: priceRow, reference, now } = context;
  const reported = priceRow && currentRowPrice(priceRow);
  const tradingDate = tradingDateNoon(priceRow?.tradingDate);
  const quality = validateReportedPrice({ price: reported, tradingDate, now, sourceQuality: priceRow?.dataQuality });
  const current = reported !== undefined && reported.isFinite() && reported.gt(0) ? reported : undefined;
  const verifiedChange = priceRow?.changePercent;
  const volume = priceRow?.volume;
  const validUntil = priceRow?.dataQuality?.validUntilEpoch;
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name ?? row.symbol,
    issuer: row.name ?? row.symbol,
    issuerID: row.issuerID,
    isin: row.isin,
    currency: row.currency,
    kind: classifySecurityKind({ type: row.securityType, name: row.name, symbol: row.symbol }),
    price: current ?? ZERO,
    percentageChange: current && verifiedChange?.isFinite() ? verifiedChange : ZERO,
    volume: volume !== undefined && volume.isFinite() && volume.gte(0) ? volume : ZERO,
    isWatched: false,
    history: [],
    quoteAvailability: current ? "available" : "unavailable",
    details: {
      openingPrice: priceRow?.openPrice,
      highPrice: priceRow?.highPrice,
      lowPrice: priceRow?.lowPrice,
      tradeCount: priceRow?.tradeCount,
    },
    quoteQuality: quality,
    hasVerifiedMovement: verifiedChange?.isFinite() === true,
    closingPrice: context.closingPrice,
    referencePrice: referencePrice(reference?.referencePrice, now),
    referenceUnavailableReason: reference?.unavailableReason,
    referenceLastCheckedAt: parseInstant(reference?.lastCheckedAt),
    referenceUpdateStatus: reference?.updateStatus,
    referenceUpdateReason: reference?.updateReason,
    reportedPercentageChange: current ? priceRow?.reportedChangePercent : undefined,
    marketStatus: context.marketStatus,
    quoteTradingDate: tradingDate,
    isListed: row.isActive,
    officialMarketVisibility: context.isActive,
    marketContextValidUntil: validUntil === undefined ? undefined : validUntil * SECOND_MS,
  };
}

/** Rows that appear more than once for the same key are ambiguous and dropped. */
function unique<T>(rows: readonly T[], key: (row: T) => string): Map<string, T> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return new Map(rows.filter((row) => counts.get(key(row)) === 1).map((row) => [key(row), row]));
}

const bySymbol = (a: MarketSecurity, b: MarketSecurity) => (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0);

function statistics(quotes: CurrentMarketQuotes, status: MarketStatus, generatedAt?: EpochMs) {
  const session = quotes.sessions[0];
  const overview = quotes.overview[0];
  const quality: DataQualityReport = session?.dataQuality ?? qualityFailure("unknown", "missingProvenance");
  const trusted = permitsInsight(quality);
  const sourceObserved = quality.sourceObservedAtEpoch;
  return {
    index: EMPTY_MARKET_INDEX,
    status,
    sessionVolume: trusted ? (session?.totalVolume ?? ZERO) : ZERO,
    trades: trusted ? (session?.tradeCount ?? 0) : 0,
    statisticsQuality: quality,
    sourceMetadata: {
      tradingDate: tradingDateNoon(overview?.sourceTradingDate) ?? tradingDateNoon(session?.tradingDate),
      collectedAt: parseInstant(overview?.collectedAt),
      publishedAt: parseInstant(overview?.publishedAt),
      dataStatus: overview?.dataStatus,
      sourceObservedAt: sourceObserved === undefined ? undefined : sourceObserved * SECOND_MS,
      availability: quotes.availability,
      snapshotGeneratedAt: generatedAt,
    },
  };
}

/**
 * The full snapshot from the shared bundle or the three direct reads. `closes` is `undefined`
 * when the verified closes could not be read; the catalogue still loads.
 */
export function buildMarketSnapshot(
  input: {
    securities: readonly SecurityRow[];
    quotes: CurrentMarketQuotes;
    closes?: readonly VerifiedCloseRow[];
    generatedAt?: EpochMs;
  },
  now: EpochMs,
): MarketSnapshot {
  const { quotes } = input;
  const session = quotes.sessions[0];
  const overview = quotes.overview[0];
  const marketStatus = marketStatusFromServer(overview?.status ?? session?.status);
  const prices = unique(quotes.prices, (row) => row.securityID);
  const references = unique(quotes.referencePrices ?? [], (row) => row.securityID);
  const closes = unique(input.closes ?? [], (row) => row.securityID);
  const active = quotes.activeSecurityIDs && new Set(quotes.activeSecurityIDs);
  const securities = [...unique(input.securities, (row) => row.id).values()]
    .map((row) => {
      const close = closes.get(row.id);
      return makeSecurity(row, {
        price: prices.get(row.id),
        closingPrice: close && verifiedClosingPrice(close, now),
        reference: references.get(row.id),
        isActive: active?.has(row.id),
        marketStatus,
        now,
      });
    })
    .sort(bySymbol);
  return {
    ...statistics(quotes, marketStatus, input.generatedAt),
    securities,
    updatedAt: parseInstant(overview?.lastUpdatedAt) ?? parseInstant(session?.publishedAt) ?? parseInstant(session?.updatedAt),
    unavailableSections: input.closes === undefined ? [MARKET_MESSAGE_KEYS.verifiedClosesSection] : [],
  };
}

/** The shared bundle is accepted only for contract 1 and a build time no later than now + 60 s. */
export function acceptSnapshotBundle(bundle: MarketSnapshotBundle, now: EpochMs): EpochMs {
  const generatedAt = parseInstant(bundle.generatedAt);
  if (bundle.contractVersion !== 1 || generatedAt === undefined || generatedAt > now + 60 * SECOND_MS) {
    throw new MarketDecodingError("market.snapshotContract");
  }
  return generatedAt;
}

/**
 * The compact Home projection, or `undefined` when the server asks for the full snapshot.
 * Throws when the projection is malformed or cannot be shown as current.
 */
export function buildHomeProjection(response: HomeProjectionResponse, now: EpochMs): HomeMarketProjection | undefined {
  if (response.contractVersion !== 1 || response.requiresFullSnapshot !== false) return undefined;
  const { securities: rows, quotes, summary, calendar: calendarRow } = response;
  const generatedAt = parseInstant(response.generatedAt);
  const ids = new Set(rows?.map((row) => row.id));
  const priceIDs = new Set(quotes?.prices.map((row) => row.securityID));
  if (
    !rows ||
    !quotes ||
    !summary ||
    !calendarRow ||
    generatedAt === undefined ||
    generatedAt > now ||
    rows.length > 9 ||
    ids.size !== rows.length ||
    priceIDs.size !== quotes.prices.length ||
    ids.size !== priceIDs.size ||
    ![...ids].every((id) => priceIDs.has(id)) ||
    summary.instrumentCount < rows.length ||
    summary.availableQuoteCount < rows.length ||
    summary.availableQuoteCount > summary.instrumentCount ||
    !Number.isFinite(summary.validUntilEpoch) ||
    summary.validUntilEpoch <= now / SECOND_MS
  ) {
    throw new MarketDecodingError("market.homeContract");
  }
  const calendar: MarketCalendar = decodeMarketCalendar(calendarRow, now);
  if (summary.validUntilEpoch * SECOND_MS > calendar.validUntil) throw new MarketDecodingError("market.homeDeadline");
  const prices = unique(quotes.prices, (row) => row.securityID);
  const references = unique(quotes.referencePrices ?? [], (row) => row.securityID);
  const status = marketStatusFromServer(quotes.overview[0]?.status ?? quotes.sessions[0]?.status);
  const hasCoverage = summaryCoverage(summary) !== undefined;
  const securities = rows
    .map((row) =>
      makeSecurity(row, {
        price: prices.get(row.id),
        reference: references.get(row.id),
        isActive: hasCoverage ? row.isActive : undefined,
        marketStatus: status,
        now,
      }),
    )
    .sort(bySymbol);
  const session = quotes.sessions[0];
  const cards: MarketSnapshot = {
    ...statistics(quotes, status),
    securities,
    updatedAt: parseInstant(quotes.overview[0]?.lastUpdatedAt) ?? parseInstant(session?.publishedAt),
  };
  const projection: HomeMarketProjection = { cards, summary, calendar, generatedAt };
  const assessed = projectionSnapshot(projection, now);
  if (
    assessed.status !== "open" ||
    !assessed.securities.every((security) => hasUsableQuote(security, now)) ||
    !assessed.securities.every((security) => summary.validUntilEpoch <= (security.quoteQuality?.validUntilEpoch ?? 0))
  ) {
    throw new MarketDecodingError("market.homeEligibility");
  }
  return projection;
}

/** The market indicator is shown only when every row is valid and dated once; otherwise it is empty. */
export function makeMarketIndex(rows: readonly MarketPulseRow[], includesHistory = true): MarketIndex {
  const sorted = [...rows].sort((a, b) => (a.tradingDate < b.tradingDate ? -1 : a.tradingDate > b.tradingDate ? 1 : 0));
  const valid = sorted.filter(
    (row) =>
      tradingDateNoon(row.tradingDate) !== undefined &&
      row.value.isFinite() &&
      row.value.gt(0) &&
      row.dailyChangePercent.isFinite() &&
      row.dataQuality !== undefined &&
      permitsInsight(row.dataQuality),
  );
  if (valid.length !== rows.length || new Set(valid.map((row) => row.tradingDate)).size !== valid.length) {
    return EMPTY_MARKET_INDEX;
  }
  const latest = valid.at(-1);
  const previous = valid.at(-2);
  return {
    value: latest?.value,
    dailyChange: latest && previous ? latest.value.minus(previous.value) : undefined,
    percentageChange: latest?.dailyChangePercent,
    history: includesHistory
      ? valid.flatMap((row) => {
          const date = tradingDateNoon(row.tradingDate);
          return date === undefined ? [] : [{ date, value: row.value }];
        })
      : [],
    tradingDate: latest && tradingDateNoon(latest.tradingDate),
  };
}
