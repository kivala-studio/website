import { type ActivityItem, type PrivacyClass, mergeItems } from "../activity/activity";
import { publicationWindow } from "../news/article";
import type { EpochMs } from "../market/zone";
import type { PortfolioTransaction } from "../portfolio/models";
import { decodeExact, encodeExact, sha256Hex } from "./cache";
import type { Insight, InsightCategory, InsightPeriod } from "./models";
import { type IntelligencePrivacyClassification, privacyClassification } from "./privacy";

/*
 * Local insights in the Activity centre (iOS `ActivityPolicy.insightItems`, `ActivityPolicy.isVisible`,
 * `ActivityArchive`, `ActivityPersistence`). Server notifications and alert deliveries stay in W9's
 * `src/domain/activity`; this module turns engine insights into rows, keeps their read state and corrections in a
 * per-account archive, and hands W9 ordinary `ActivityItem`s to merge. Rows carry no values, quantities or formulas.
 */

const DAY = 86_400_000;
export const LOCAL_ACTIVITY_RETENTION = 56 * DAY;
export const LOCAL_ACTIVITY_MAXIMUM_ITEMS = 200;
/** iOS `InsightFreshnessPolicy.maximumFetchAge`. */
export const MAXIMUM_FETCH_AGE = 15 * 60_000;

export type LocalActivityDestination =
  | { readonly kind: "asset"; readonly assetID: string }
  | { readonly kind: "news"; readonly articleID: string }
  | { readonly kind: "portfolioInsight"; readonly insightID: string }
  | { readonly kind: "watchlistInsight"; readonly insightID: string };

export interface LocalActivityItem {
  readonly id: string;
  readonly insightID: string;
  readonly destination: LocalActivityDestination;
  readonly createdAt: EpochMs;
  readonly occurredAt: EpochMs;
  readonly expiresAt: EpochMs;
  readonly priority: number;
  readonly relatedAssetIDs: readonly string[];
  readonly aliases: readonly string[];
  readonly readAt: EpochMs | null;
  readonly corrected: boolean;
  readonly unavailable: boolean;
}

export interface InterestProfileSeed {
  readonly holdingIDs: ReadonlySet<string>;
  readonly watchedIDs: ReadonlySet<string>;
}

export interface InsightItemDependencies {
  /** iOS `InsightPersonalization.ranked(_, surface: .activityCenter, profile:, asOf:, limit: 3)`. */
  readonly rank: (insights: readonly Insight[], profile: InterestProfileSeed, now: EpochMs, limit: number) => readonly Insight[];
  /** iOS `WatchlistInsightPolicy.receiptKeys(for:)`. */
  readonly receiptKeys: (insight: Insight) => Iterable<string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Version and changing values do not create another unread row for the same period. */
function semanticIdentity(insight: Insight): string {
  const assets =
    insight.category === "portfolio"
      ? "portfolio"
      : [...insight.relatedAssetIDs]
          .sort(byText)
          .map((id) => `${new TextEncoder().encode(id).length}:${id}`)
          .join("|");
  return `fact:${insight.type}:${assets}:${seconds(insight.period.start)}:${seconds(insight.period.endExclusive)}`;
}

/** Epoch seconds as Swift prints a `TimeInterval` (`1790031600.0`), so ids match the iOS archive. */
const seconds = (instant: EpochMs) => {
  const value = instant / 1000;
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
};

export const stableActivityID = (identity: string) => sha256Hex(identity);

/** At most three ranked rows: watchlist readings and weekly portfolio performance, with verified provenance. */
export function insightItems(
  insights: readonly Insight[],
  watchedIDs: ReadonlySet<string>,
  now: EpochMs,
  { rank, receiptKeys }: InsightItemDependencies,
): LocalActivityItem[] {
  const eligible = insights.filter((insight) => insight.category === "watchlist" || insight.type === "portfolioPricePerformance");
  const profile = {
    holdingIDs: new Set(insights.filter((insight) => insight.category === "portfolio").flatMap((insight) => insight.relatedAssetIDs)),
    watchedIDs,
  };
  const items: LocalActivityItem[] = [];
  for (const insight of rank(eligible, profile, now, 3)) {
    const { provenance } = insight;
    if (
      !(insight.period.start < insight.period.endExclusive) ||
      !(insight.generatedAt <= now) ||
      !(now < insight.expiresAt) ||
      !(provenance.fetchedAt <= now) ||
      now - provenance.fetchedAt > MAXIMUM_FETCH_AGE ||
      provenance.calculationID === "" ||
      !(provenance.calculationVersion > 0) ||
      provenance.calendarVersion === ""
    ) {
      continue;
    }
    let destination: LocalActivityDestination;
    let occurredAt: EpochMs;
    const { fact } = insight;
    switch (fact.kind) {
      case "portfolioPerformance":
        destination = { kind: "portfolioInsight", insightID: insight.id };
        occurredAt = fact.value.lastObservedAt;
        break;
      case "watchlistMovement":
        destination = { kind: "asset", assetID: fact.value.movement.assetID };
        occurredAt = fact.value.movement.lastObservedAt;
        break;
      case "watchlistSessionRun":
      case "watchlistClosingExtreme":
        destination = { kind: "asset", assetID: fact.value.assetID };
        occurredAt = fact.value.lastObservedAt;
        break;
      case "watchlistInformation":
        if (!UUID.test(fact.value.articleID)) continue;
        destination = { kind: "news", articleID: fact.value.articleID.toLowerCase() };
        occurredAt = fact.value.publishedAt;
        break;
      case "breadth":
        destination = { kind: "watchlistInsight", insightID: insight.id };
        occurredAt = provenance.observations.length ? Math.max(...provenance.observations.map((row) => row.observedAt)) : insight.period.start;
        break;
      default:
        continue;
    }
    if (!(occurredAt <= now)) continue;
    const identity = semanticIdentity(insight);
    items.push({
      id: stableActivityID(identity),
      insightID: insight.id,
      destination,
      createdAt: now,
      occurredAt,
      expiresAt: insight.expiresAt,
      priority: insight.category === "portfolio" ? 2 : 3,
      relatedAssetIDs: insight.relatedAssetIDs,
      aliases: [...new Set([...receiptKeys(insight), identity])].sort(byText),
      readAt: null,
      corrected: false,
      unavailable: false,
    });
  }
  return items;
}

export interface LocalActivityContext {
  /** Null until the watchlist has loaded: watchlist rows stay hidden. */
  readonly watchedIDs: ReadonlySet<string> | null;
  /** Null until the ledger has loaded: portfolio rows stay hidden. */
  readonly portfolioTransactions: readonly PortfolioTransaction[] | null;
}

const sameSet = (a: Iterable<string>, b: ReadonlySet<string>) => {
  const left = new Set(a);
  return left.size === b.size && [...left].every((id) => b.has(id));
};

/** A row is shown only while the watchlist and ledger it was computed from are still the current ones. */
export function isLocalVisible(item: LocalActivityItem, sources: ReadonlyMap<string, Insight>, context: LocalActivityContext, now: EpochMs): boolean {
  if (
    !Number.isFinite(now) ||
    !(item.createdAt <= now) ||
    !(item.occurredAt <= now) ||
    !(now < item.expiresAt) ||
    now - item.createdAt >= LOCAL_ACTIVITY_RETENTION
  )
    return false;
  if (item.destination.kind === "news" && item.occurredAt < publicationWindow(now).start) return false;
  if (item.unavailable) return false;
  const insight = sources.get(item.insightID);
  if (!insight) return false;
  if (insight.category === "watchlist") {
    const watched = context.watchedIDs;
    if (!watched || !insight.relatedAssetIDs.every((id) => watched.has(id))) return false;
    if (insight.fact.kind === "watchlistMovement" && !sameSet(insight.fact.value.comparedAssetIDs, watched)) return false;
    if (insight.fact.kind === "breadth" && !sameSet(insight.relatedAssetIDs, watched)) return false;
  }
  if (insight.category === "portfolio" && !insight.serverNotificationID) {
    const transactions = context.portfolioTransactions;
    const evidence = insight.provenance.portfolio;
    if (!transactions || !evidence) return false;
    const current = new Set(transactions.map((row) => JSON.stringify(encodeExact(row))));
    const recorded = new Set(evidence.transactions.map((row) => JSON.stringify(encodeExact(row))));
    if (current.size !== recorded.size || [...recorded].some((row) => !current.has(row))) return false;
  }
  return true;
}

// MARK: Archive

/** The source registry stores each insight once; items only reference it. */
export interface LocalActivityArchive {
  readonly items: readonly LocalActivityItem[];
  readonly insights: Readonly<Record<string, Insight>>;
}

export const EMPTY_ARCHIVE: LocalActivityArchive = { items: [], insights: {} };

const intersects = (a: readonly string[], b: readonly string[]) => a.some((alias) => b.includes(alias));
const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])].sort(byText);
const sameFact = (a: Insight, b: Insight) => JSON.stringify(encodeExact(a.fact)) === JSON.stringify(encodeExact(b.fact));

/** Identity, first-seen time and read state survive corrections and retries; a changed fact marks the row corrected. */
export function mergeArchive(
  archive: LocalActivityArchive,
  candidates: readonly LocalActivityItem[],
  sources: readonly Insight[],
  now: EpochMs,
): LocalActivityArchive {
  const incoming = new Map(sources.map((insight) => [insight.id, insight]));
  const items = [...archive.items];
  for (const candidate of candidates) {
    const index = items.findIndex((item) => intersects(item.aliases, candidate.aliases));
    if (index < 0) {
      items.push(candidate);
      continue;
    }
    const previous = items[index];
    const old = archive.insights[previous.insightID];
    const replacement = incoming.get(candidate.insightID);
    items[index] = {
      ...candidate,
      id: previous.id,
      createdAt: previous.createdAt,
      aliases: union(previous.aliases, candidate.aliases),
      readAt: previous.readAt ?? candidate.readAt,
      corrected: previous.corrected || (old !== undefined && replacement !== undefined && old.type === replacement.type && !sameFact(old, replacement)),
    };
  }
  const insights = { ...archive.insights };
  for (const source of sources) insights[source.id] = source;
  return pruneArchive({ items, insights }, now);
}

/** A successful authoritative refresh withdraws an invalidated fact without creating a new row. */
export function reconcileArchive(
  archive: LocalActivityArchive,
  category: InsightCategory,
  period: InsightPeriod,
  candidates: readonly LocalActivityItem[],
): LocalActivityArchive {
  const aliases = candidates.flatMap((candidate) => candidate.aliases);
  return {
    ...archive,
    items: archive.items.map((item) => {
      const source = archive.insights[item.insightID];
      if (
        !source ||
        source.category !== category ||
        source.period.start !== period.start ||
        source.period.endExclusive !== period.endExclusive ||
        source.type === "watchlistInformation" ||
        intersects(item.aliases, aliases)
      ) {
        return item;
      }
      return { ...item, unavailable: true };
    }),
  };
}

export function markArchiveRead(archive: LocalActivityArchive, ids: ReadonlySet<string>, now: EpochMs): LocalActivityArchive {
  return { ...archive, items: archive.items.map((item) => (ids.has(item.id) && item.readAt === null ? { ...item, readAt: now } : item)) };
}

export function pruneArchive(archive: LocalActivityArchive, now: EpochMs): LocalActivityArchive {
  const items = archive.items
    .filter((item) => now - item.createdAt < LOCAL_ACTIVITY_RETENTION)
    .sort((a, b) => (a.createdAt !== b.createdAt ? b.createdAt - a.createdAt : byText(a.id, b.id)))
    .slice(0, LOCAL_ACTIVITY_MAXIMUM_ITEMS);
  const referenced = new Set(items.map((item) => item.insightID));
  return { items, insights: Object.fromEntries(Object.entries(archive.insights).filter(([id]) => referenced.has(id))) };
}

export const encodeArchive = (archive: LocalActivityArchive) => JSON.stringify(encodeExact({ version: 1, ...archive }));

export function decodeArchive(text: string | undefined, now: EpochMs): LocalActivityArchive {
  if (!text) return EMPTY_ARCHIVE;
  try {
    const value = decodeExact(JSON.parse(text)) as { version?: unknown; items?: unknown; insights?: unknown };
    if (value.version !== 1 || !Array.isArray(value.items) || typeof value.insights !== "object" || value.insights === null) return EMPTY_ARCHIVE;
    return pruneArchive({ items: value.items as LocalActivityItem[], insights: value.insights as Record<string, Insight> }, now);
  } catch {
    return EMPTY_ARCHIVE;
  }
}

// MARK: Centre rows

const PRIVACY: Record<IntelligencePrivacyClassification, PrivacyClass> = {
  publicMarket: "public_market",
  personalContext: "personal_context",
  privateFinancial: "private_financial",
};

/** The composed sentence of one insight (product voice); null leaves the row out. */
export type InsightComposer = (insight: Insight) => { title: string; body: string; accessibilityText?: string | null } | null;

/** W9 rows from the archive's visible local items. Privacy masking happens in W9's `activityText`. */
export function localActivityRows(archive: LocalActivityArchive, context: LocalActivityContext, now: EpochMs, compose: InsightComposer): ActivityItem[] {
  const sources = new Map(Object.entries(archive.insights));
  const rows: ActivityItem[] = [];
  for (const item of archive.items) {
    const insight = sources.get(item.insightID);
    if (!insight || !isLocalVisible(item, sources, context, now)) continue;
    const text = compose(insight);
    if (!text) continue;
    const destination: ActivityItem["destination"] =
      item.destination.kind === "asset"
        ? { kind: "instrument", securityID: item.destination.assetID }
        : item.destination.kind === "news"
          ? { kind: "article", articleID: item.destination.articleID, slug: null }
          : item.destination.kind === "portfolioInsight"
            ? { kind: "portfolio" }
            : { kind: "watchlist" };
    rows.push({
      id: `insight:${item.id}`,
      occurredAt: item.occurredAt,
      category: insight.category === "portfolio" ? "portfolio" : "watchlist",
      destination,
      priority: item.priority,
      read: item.readAt !== null,
      privacy: PRIVACY[privacyClassification(insight)],
      newsWindow: item.destination.kind === "news",
      copy: { kind: "composition", title: text.title, body: text.body, accessibilityText: text.accessibilityText ?? null },
      notificationIDs: [],
      deliveryIDs: [],
    });
  }
  return rows;
}

/** The centre's list: server rows and local rows together, newest first. */
export const mergeActivityCentre = (server: readonly ActivityItem[], local: readonly ActivityItem[]) => mergeItems(server, local);

/** Archive ids of the local rows a reader opened or marked read (`insight:<id>` → `<id>`). */
export const localReadIDs = (rows: readonly ActivityItem[]) =>
  new Set(rows.filter((row) => row.id.startsWith("insight:")).map((row) => row.id.slice("insight:".length)));
