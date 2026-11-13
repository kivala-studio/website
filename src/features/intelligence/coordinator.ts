import { type CachedIntelligence, isUsable, makeReading, marketFingerprint, replay } from "@/domain/intelligence/cache";
import { InsightEngine, type InsightInput } from "@/domain/intelligence/engine";
import { type IntelligenceAvailability, allows as featureAllows, permitsInsightType } from "@/domain/intelligence/feature-controls";
import {
  EMPTY_ARCHIVE,
  type LocalActivityArchive,
  decodeArchive,
  encodeArchive,
  insightItems,
  markArchiveRead,
  mergeArchive,
  pruneArchive,
  reconcileArchive,
} from "@/domain/intelligence/activity";
import {
  type Insight,
  type InsightPeriod,
  type PortfolioSecurityMetadata,
  WATCHLIST_SIGNIFICANCE,
  type WatchlistPublication,
} from "@/domain/intelligence/models";
import type { MarketCalendar } from "@/domain/market/calendar";
import type { MarketSecurity } from "@/domain/market/models";
import { DAY_MS, MINUTE_MS, civilDate } from "@/domain/market/zone";
import { eligible, interestProfile, rankInsights, rankedAssetIDs, receiptKeys } from "@/domain/personalisation";
import type { PortfolioTransaction } from "@/domain/portfolio/models";
import { type TransactionWire, allowsFractionalQuantity, fromWire } from "@/domain/portfolio/records";
import { LocalProductVoice } from "@/domain/product-voice";
import { clearIntelligenceCache, intelligenceCache, loadActivityArchive, saveActivityArchive, setIntelligenceUser } from "@/data/intelligence/cache-store";
import { decodeMarketPeriodEvidence } from "@/data/intelligence/evidence";
import { refreshedIntelligenceAvailability } from "@/data/intelligence/feature-config";
import { personalisationSession } from "@/data/personalisation/personalisation";
import { readAccountRoute } from "@/features/account/results";

/*
 * One weekly reading per account and tab (iOS `WatchlistInsightCoordinator`, `PortfolioInsightCoordinator`,
 * `SaturdayDiscoverCoordinator`): the route hands over verified closes, recent publications and the ledger; the
 * engine runs here, in the browser, for the signed-in account only. Every await is followed by a check that the
 * same request and account are still current. Saved readings replay only while the market is closed.
 */

/** Evidence older than this is fetched again (iOS `InsightFreshnessPolicy.maximumFetchAge`). */
const MAXIMUM_FETCH_AGE = 15 * MINUTE_MS;
const CLOSED_STATES = new Set(["closed", "postClose", "weekend", "holiday"]);

export type ReadingKind = "watchlist" | "portfolio";

export interface IntelligenceInputs {
  readonly userID: string;
  readonly calendar: MarketCalendar | undefined;
  readonly securities: readonly MarketSecurity[] | undefined;
  readonly watchedIDs: readonly string[];
  readonly hidesPersonalValues: boolean;
}

export interface IntelligenceState {
  readonly userID: string | null;
  readonly status: "idle" | "loading" | "ready" | "unavailable";
  /** One of the sources (closes, publications) failed this time. */
  readonly partial: boolean;
  readonly generatedAt: number | null;
  readonly availability: IntelligenceAvailability | null;
  /** Live watchlist and portfolio facts, unranked. */
  readonly watchlist: readonly Insight[];
  readonly portfolio: readonly Insight[];
  /** Watchlist, portfolio, market and publication facts together (Saturday Discover). */
  readonly combined: readonly Insight[];
  readonly watchedIDs: ReadonlySet<string>;
  /** The ledger the reading was computed from; null when it could not be read. */
  readonly transactions: readonly PortfolioTransaction[] | null;
  readonly saved: Readonly<Record<ReadingKind, CachedIntelligence | null>>;
  /** The surface shows its saved reading: the live one failed while the market is closed. */
  readonly usesSaved: Readonly<Record<ReadingKind, boolean>>;
  readonly archive: LocalActivityArchive;
  /** Receipt keys consumed in this tab (opened, dismissed, read in Activity). */
  readonly consumed: ReadonlySet<string>;
  /** Article slug per publication id, for links to the article page. */
  readonly slugs: Readonly<Record<string, string>>;
}

const INITIAL: IntelligenceState = {
  userID: null,
  status: "idle",
  partial: false,
  generatedAt: null,
  availability: null,
  watchlist: [],
  portfolio: [],
  combined: [],
  watchedIDs: new Set(),
  transactions: null,
  saved: { watchlist: null, portfolio: null },
  usesSaved: { watchlist: false, portfolio: false },
  archive: EMPTY_ARCHIVE,
  consumed: new Set(),
  slugs: {},
};

interface Payload {
  readonly evidence: unknown;
  readonly publications: {
    readonly fetchedAt: number;
    readonly articles: readonly WatchlistPublication[];
    readonly slugs?: Readonly<Record<string, string>>;
  } | null;
  readonly ledger: { readonly fetchedAt: number; readonly transactions: readonly TransactionWire[] } | null;
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((id) => b.has(id));

/** The market is closed now, so a saved reading may stand in for a live one (iOS `permitsClosingCache`). */
export const permitsSavedReading = (calendar: MarketCalendar | undefined, now: number) => !!calendar && CLOSED_STATES.has(calendar.state(now));

function metadata(security: MarketSecurity): PortfolioSecurityMetadata {
  return {
    assetID: security.id,
    symbol: security.symbol,
    currencyCode: security.currency ?? "",
    supportsUnitValuation: security.kind === "equity" || security.kind === "fund",
    issuerID: security.issuerID ?? null,
    issuerName: security.issuer || null,
    // The catalogue carries no issuer sector yet: sector groups never form.
    sector: null,
    allowsFractionalQuantity: allowsFractionalQuantity(security.kind),
  };
}

export class IntelligenceCoordinator {
  private state: IntelligenceState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private request = 0;
  private refreshedAt: number | null = null;
  private periodKey: string | null = null;
  readonly voice = new LocalProductVoice();

  constructor(private readonly now: () => number = Date.now) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private set(changes: Partial<IntelligenceState>) {
    this.state = { ...this.state, ...changes };
    for (const listener of this.listeners) listener();
  }

  private current(token: number, userID: string) {
    return this.request === token && this.state.userID === userID;
  }

  /** The earliest instant a shown fact or saved reading lapses: the surfaces re-evaluate then. */
  nextExpiry(): number | null {
    const { watchlist, portfolio, saved } = this.state;
    const times = [...watchlist, ...portfolio]
      .map((insight) => insight.expiresAt)
      .concat([saved.watchlist?.expiresAt, saved.portfolio?.expiresAt].filter((value): value is number => value != null));
    const now = this.now();
    const future = times.filter((time) => time > now);
    return future.length ? Math.min(...future) : null;
  }

  /** Sign-out, or another account: nothing of the previous one stays in the tab. */
  reset() {
    this.request += 1;
    this.refreshedAt = null;
    this.periodKey = null;
    this.state = INITIAL;
    for (const listener of this.listeners) listener();
  }

  private async activate(userID: string) {
    if (this.state.userID === userID) return;
    this.reset();
    setIntelligenceUser(userID);
    this.voice.activate(userID);
    this.set({ userID });
    const token = this.request;
    const archive = decodeArchive(await loadActivityArchive(userID), this.now());
    if (!this.current(token, userID)) return;
    this.set({ archive });
  }

  /** Reads the week again when it is due (or `force`), evaluates it here, and keeps the completed reading. */
  async refresh(inputs: IntelligenceInputs, force = false): Promise<void> {
    const { userID, calendar, securities } = inputs;
    await this.activate(userID);
    if (this.state.userID !== userID || !calendar || !securities) return;
    const now = this.now();
    const watched = new Set(inputs.watchedIDs);
    personalisationSession.privacyMode = inputs.hidesPersonalValues;
    const token = ++this.request;

    if (permitsSavedReading(calendar, now) && !this.state.saved.watchlist && !this.state.saved.portfolio) {
      const [watchlist, portfolio] = await Promise.all([intelligenceCache.load(userID, "watchlist", now), intelligenceCache.load(userID, "portfolio", now)]);
      if (!this.current(token, userID)) return;
      this.set({ saved: { watchlist, portfolio } });
    }
    await personalisationSession.refresh(userID);
    if (!this.current(token, userID)) return;

    const week = calendar.previousCompletedTradingWeek(now)?.period;
    if (!week) return this.useSaved();
    const periodKey = `${week.start}:${week.endExclusive}`;
    const fresh =
      this.refreshedAt !== null &&
      now - this.refreshedAt < MAXIMUM_FETCH_AGE &&
      [...this.state.watchlist, ...this.state.portfolio].every((insight) => now < insight.expiresAt);
    if (!force && fresh && periodKey === this.periodKey && sameSet(watched, this.state.watchedIDs)) return;

    this.set({ status: "loading" });
    const lease = intelligenceCache.lease();
    const query = new URLSearchParams({ starts_on: civilDate(week.start), ends_on: civilDate(week.endExclusive - DAY_MS) });
    let payload: Payload;
    let availability: IntelligenceAvailability;
    try {
      [payload, availability] = await Promise.all([
        readAccountRoute(`/api/account/intelligence?${query}`, userID) as Promise<unknown> as Promise<Payload>,
        refreshedIntelligenceAvailability(now),
      ]);
    } catch {
      if (this.current(token, userID)) this.useSaved();
      return;
    }
    if (!this.current(token, userID)) return;

    const generatedAt = this.now();
    let evidence: ReturnType<typeof decodeMarketPeriodEvidence> | null = null;
    try {
      evidence = payload.evidence == null ? null : decodeMarketPeriodEvidence(payload.evidence, { ...week, kind: "weekly" }, generatedAt);
    } catch {
      evidence = null;
    }
    const publications = payload.publications
      ? {
          period: { start: generatedAt - WATCHLIST_SIGNIFICANCE.publicationAgeMs, endExclusive: generatedAt },
          fetchedAt: payload.publications.fetchedAt,
          articles: payload.publications.articles,
        }
      : null;
    const transactions = payload.ledger ? payload.ledger.transactions.map(fromWire) : null;
    const held = new Set((transactions ?? []).map((item) => item.securityId));
    const portfolioInput =
      transactions && transactions.length > 0
        ? {
            week: { start: week.start, endExclusive: week.endExclusive },
            transactions,
            securities: securities.map(metadata),
            ledgerFetchedAt: payload.ledger!.fetchedAt,
            metadataFetchedAt: generatedAt,
          }
        : null;
    const base: InsightInput = {
      period: evidence?.comparisonPeriod ?? week,
      generatedAt,
      fetchedAt: evidence?.fetchedAt ?? generatedAt,
      calendar: evidence?.calendar ?? null,
      observations: evidence?.observations ?? [],
      watchlistIDs: new Set(),
      portfolioIDs: new Set(),
      activityAssetIDs: [],
    };
    const engineAvailability = {
      allows: (feature: string) => featureAllows(availability, feature as never),
      permits: (type: Insight["type"]) => permitsInsightType(availability, type),
    };
    const engine = new InsightEngine({ availability: engineAvailability });
    const watchlist = watched.size
      ? engine.evaluate({ ...base, watchlistIDs: watched, publications }).filter((insight) => insight.category === "watchlist")
      : [];
    const portfolio =
      evidence && portfolioInput
        ? engine.evaluate({ ...base, portfolioIDs: held, portfolio: portfolioInput }).filter((insight) => insight.category === "portfolio")
        : [];
    const combined = new InsightEngine({ availability: engineAvailability, includesMarketPublications: true }).evaluate({
      ...base,
      watchlistIDs: watched,
      portfolioIDs: held,
      activityAssetIDs: rankedAssetIDs(personalisationSession.profile(held, watched)),
      portfolio: portfolioInput,
      publications,
    });

    const saved = {
      watchlist: watched.size ? makeReading({ kind: "watchlist", insights: watchlist, securities, watchedIDs: watched, now: generatedAt }) : null,
      portfolio: transactions?.length ? makeReading({ kind: "portfolio", insights: portfolio, securities, transactions, now: generatedAt }) : null,
    };
    if (saved.watchlist && watchlist.length) void intelligenceCache.save(saved.watchlist, userID, lease);
    else if (!watched.size) void intelligenceCache.invalidate(userID, "watchlist");
    if (saved.portfolio && portfolio.length) void intelligenceCache.save(saved.portfolio, userID, lease);
    else if (transactions && !transactions.length) void intelligenceCache.invalidate(userID, "portfolio");

    const archive = this.ingest(this.state.archive, watchlist, portfolio, watched, held, generatedAt, evidence?.comparisonPeriod ?? null);
    this.refreshedAt = generatedAt;
    this.periodKey = periodKey;
    this.set({
      status: evidence || publications ? "ready" : "unavailable",
      partial: !evidence || !publications,
      generatedAt,
      availability,
      watchlist,
      portfolio,
      combined,
      watchedIDs: watched,
      transactions,
      saved: { watchlist: saved.watchlist ?? this.state.saved.watchlist, portfolio: saved.portfolio ?? this.state.saved.portfolio },
      usesSaved: { watchlist: false, portfolio: false },
      archive,
      slugs: { ...this.state.slugs, ...(payload.publications?.slugs ?? {}) },
    });
    void saveActivityArchive(userID, encodeArchive(archive));
  }

  /** Local Activity rows for the reading (iOS `ActivityCenterStore.ingest`): at most three, ranked. */
  private ingest(
    archive: LocalActivityArchive,
    watchlist: readonly Insight[],
    portfolio: readonly Insight[],
    watched: ReadonlySet<string>,
    held: ReadonlySet<string>,
    now: number,
    period: InsightPeriod | null,
  ): LocalActivityArchive {
    const exposure = personalisationSession.exposure;
    const rank = (insights: readonly Insight[], seed: { holdingIDs: ReadonlySet<string>; watchedIDs: ReadonlySet<string> }, at: number, limit: number) =>
      rankInsights(insights, {
        surface: "activityCenter",
        profile: interestProfile({ holdingIDs: seed.holdingIDs, watchedIDs: seed.watchedIDs }),
        exposure,
        now: at,
        limit,
      });
    const candidates = insightItems([...watchlist, ...portfolio], watched, now, { rank, receiptKeys });
    let next = mergeArchive(pruneArchive(archive, now), candidates, [...watchlist, ...portfolio], now);
    if (period) {
      next = reconcileArchive(next, "watchlist", period, candidates);
      if (held.size) next = reconcileArchive(next, "portfolio", period, candidates);
    }
    return next;
  }

  private useSaved() {
    const { saved } = this.state;
    this.set({
      status: saved.watchlist || saved.portfolio ? "ready" : "unavailable",
      usesSaved: { watchlist: !!saved.watchlist, portfolio: !!saved.portfolio },
    });
  }

  /** A saved reading as the surface may show it now: usable, fingerprints unchanged, the market closed. */
  replaySaved(
    kind: ReadingKind,
    now: number,
    calendar: MarketCalendar | undefined,
    securities: readonly MarketSecurity[],
    fingerprints: { watchlist?: Iterable<string>; ledger?: string | null },
  ): Insight[] {
    const reading = this.state.saved[kind];
    if (!reading || !this.state.usesSaved[kind] || !permitsSavedReading(calendar, now) || !this.state.availability) return [];
    const market = marketFingerprint(securities);
    if (!isUsable(reading, now, { ...fingerprints, market })) return [];
    return replay(reading, now, {
      availability: this.state.availability,
      eligible: (insight, context, surface) => eligible(insight, { ...context, maximumObservationAge: WATCHLIST_SIGNIFICANCE.publicationAgeMs }, surface),
      ...fingerprints,
      market,
    });
  }

  /** Opened or dismissed (iOS `consume`): the family leaves the card and its Activity row is read. */
  async consume(insight: Insight, surface: "watchlist" | "portfolio" | "home" | "saturdayDiscover"): Promise<void> {
    const userID = this.state.userID;
    if (!userID) return;
    const keys = receiptKeys(insight);
    const consumed = new Set([...this.state.consumed, ...keys]);
    const now = this.now();
    const ids = new Set(
      this.state.archive.items.filter((item) => item.aliases.some((alias) => keys.has(alias)) || item.insightID === insight.id).map((item) => item.id),
    );
    const archive = markArchiveRead(this.state.archive, ids, now);
    this.set({ consumed, archive });
    void saveActivityArchive(userID, encodeArchive(archive));
    await personalisationSession.recordInsight(insight, true, surface, userID);
  }

  /** Privacy mode withholds personal context from ranking and receipts. */
  setPrivacyMode(enabled: boolean) {
    personalisationSession.privacyMode = enabled;
  }

  /** The Activity centre marked local rows read. */
  markRead(ids: ReadonlySet<string>) {
    const userID = this.state.userID;
    if (!userID || ids.size === 0) return;
    const archive = markArchiveRead(this.state.archive, ids, this.now());
    const aliases = archive.items.filter((item) => ids.has(item.id)).flatMap((item) => item.aliases);
    this.set({ archive, consumed: new Set([...this.state.consumed, ...aliases]) });
    void saveActivityArchive(userID, encodeArchive(archive));
  }
}

let shared: IntelligenceCoordinator | null = null;

/** The tab's coordinator: one evaluation shared by Watchlist, Portfolio, Home and Activity. */
export function intelligenceCoordinator(): IntelligenceCoordinator {
  shared ??= new IntelligenceCoordinator();
  return shared;
}

/** Sign-out: the tab forgets the reading and the browser forgets every saved one, receipts and phrasing memory. */
export function clearIntelligence(userID: string | null): void {
  shared?.reset();
  if (userID) {
    personalisationSession.clear(userID);
    new LocalProductVoice().remove(userID);
  }
  void clearIntelligenceCache();
}
