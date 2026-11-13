import "server-only";

import { readLedger } from "@/data/account/portfolio";
import type { AccountSession } from "@/data/account/session";
import { demoLedger } from "@/data/demo/portfolio";
import { readMarketPeriodEvidenceJSON } from "@/data/intelligence/evidence-server";
import { getPublicNews } from "@/data/market/public-cache";
import type { WatchlistPublication } from "@/domain/intelligence/models";
import { DAY_MS, type EpochMs, civilDate, dayStart } from "@/domain/market/zone";
import type { NewsArticle } from "@/domain/news/article";
import type { TransactionWire } from "@/domain/portfolio/records";

/** The twenty most recent publications are the only candidates (iOS `SupabaseNewsRepository.recentArticles`). */
const PUBLICATION_LIMIT = 20;

/** `/api/account/intelligence`'s body: the inputs the browser evaluates. A failed source is `null`, never a guess. */
export interface IntelligencePayload {
  readonly userID: string;
  /** The raw `get_market_period_evidence` answer; the browser validates it. */
  readonly evidence: unknown;
  readonly publications: {
    readonly fetchedAt: EpochMs;
    readonly articles: readonly WatchlistPublication[];
    readonly slugs: Readonly<Record<string, string>>;
  } | null;
  readonly ledger: { readonly fetchedAt: EpochMs; readonly transactions: readonly TransactionWire[] } | null;
}

/** A requested week: a Luanda Monday and the Friday (or any day up to Sunday) that ends it. */
export function requestedWeek(startsOn: string | null, endsOn: string | null) {
  const start = startsOn === null ? undefined : dayStart(startsOn);
  const last = endsOn === null ? undefined : dayStart(endsOn);
  if (start === undefined || last === undefined || civilDate(start) !== startsOn || civilDate(last) !== endsOn) return null;
  if (last < start || last - start > 6 * DAY_MS) return null;
  return { start, endExclusive: last + DAY_MS, kind: "weekly" as const };
}

/** iOS `NewsArticle.insightPublication`: exactly one primary source, editorially linked instruments. */
function publication(article: NewsArticle): WatchlistPublication[] {
  const primary = article.sources.filter((source) => source.isPrimary);
  if (primary.length !== 1) return [];
  return [
    {
      articleID: article.id.toLowerCase(),
      title: article.title,
      publishedAt: article.publishedAt,
      assetIDs: article.securities.map((security) => security.id.toLowerCase()),
      primarySourceURL: primary[0].url,
      sourceName: primary[0].name,
    },
  ];
}

async function settled<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch {
    return null;
  }
}

/** Each source fails on its own: the browser shows what the others still support. */
export async function readIntelligence(
  session: AccountSession,
  week: { start: EpochMs; endExclusive: EpochMs; kind: "weekly" },
  now: EpochMs,
  regularWeek: boolean,
): Promise<IntelligencePayload> {
  const [evidence, news, ledger] = await Promise.all([
    settled(() => readMarketPeriodEvidenceJSON(session, week, now, regularWeek)),
    settled(() => getPublicNews(0, PUBLICATION_LIMIT)),
    settled(async () => (session.kind === "demo" ? demoLedger() : readLedger(session.client))),
  ]);
  return {
    userID: session.userID,
    evidence,
    publications: news
      ? {
          fetchedAt: now,
          articles: news.articles.flatMap(publication),
          slugs: Object.fromEntries(news.articles.map((article) => [article.id.toLowerCase(), article.slug])),
        }
      : null,
    ledger: ledger ? { fetchedAt: now, transactions: ledger.transactions } : null,
  };
}
