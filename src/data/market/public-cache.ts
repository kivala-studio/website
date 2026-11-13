import "server-only";

import { unstable_cache } from "next/cache";

import { publicEnv } from "@/config/public-env";
import { demoBenchmarkRateRows, demoDividendRows, demoHistoryRows, demoNewsRows } from "@/data/market/demo/public-demo";
import { BENCHMARK_RATES, type BenchmarkQuote, latestBenchmarkQuotes } from "@/domain/portfolio/benchmark";
import { type IssuerDividend, addCivilDays, decodeIssuerDividend, INCOME_WINDOW_DAYS } from "@/domain/portfolio/income-calendar";
import { recordedSnapshot } from "@/data/market/demo/scenarios";
import { DAY_MS, civilDate, tradingDateNoon } from "@/domain/market/zone";
import { type NewsArticle, decodeNewsArticle, decodeNewsArticles } from "@/domain/news/article";

import { anonymousSupabase } from "../supabase/anonymous-client";
import { pricePoints, readPulseRows } from "./history";
import {
  type CatalogueRows,
  PUBLIC_HISTORY_DAYS,
  publicCatalogue,
  publicPulse,
  readBenchmarkRateRows,
  readCatalogueRows,
  readDividendRows,
  readPublicArticle,
  readPublicDividend,
  readPublicHistoryRows,
  readPublicIssuer,
  readPublicNews,
  readPublicNewsSearch,
  readPublicReports,
} from "./public";

/*
 * Cached public reads with explicit revalidation (seconds). The cache holds JSON rows from the
 * anonymous client, never a current price and never anything visitor-specific; demo mode reads the
 * recorded snapshot instead.
 */
export const PUBLIC_REVALIDATE = {
  catalogue: 300,
  history: 3600,
  pulse: 3600,
  issuer: 86_400,
  news: 60,
  rates: 3600,
} as const;

const demo = publicEnv.dataMode === "demo";

const catalogueRows = unstable_cache(() => readCatalogueRows(anonymousSupabase()), ["public-catalogue-v1"], {
  revalidate: PUBLIC_REVALIDATE.catalogue,
  tags: ["public-catalogue"],
});

/** Day keys keep the "up to today" bound of cached history aligned with the Luanda day. */
const historyRows = unstable_cache(
  (securityID: string, day: string) => readPublicHistoryRows(anonymousSupabase(), securityID, tradingDateNoon(day)!),
  ["public-history-v1"],
  { revalidate: PUBLIC_REVALIDATE.history, tags: ["public-history"] },
);

const pulseRows = unstable_cache((day: string) => readPulseRows(anonymousSupabase(), tradingDateNoon(day)!), ["public-pulse-v1"], {
  revalidate: PUBLIC_REVALIDATE.pulse,
  tags: ["public-pulse"],
});

const issuer = unstable_cache((id: string) => readPublicIssuer(anonymousSupabase(), id), ["public-issuer-v1"], {
  revalidate: PUBLIC_REVALIDATE.issuer,
});
const dividend = unstable_cache((id: string) => readPublicDividend(anonymousSupabase(), id), ["public-dividend-v1"], {
  revalidate: PUBLIC_REVALIDATE.issuer,
});
const reports = unstable_cache((id: string) => readPublicReports(anonymousSupabase(), id), ["public-reports-v1"], {
  revalidate: PUBLIC_REVALIDATE.issuer,
});
const news = unstable_cache(
  (offset: number, limit: number) => readPublicNews(anonymousSupabase(), { offset, limit, now: Date.now() }),
  ["public-news-v1"],
  { revalidate: PUBLIC_REVALIDATE.news, tags: ["public-news"] },
);
const newsSearch = unstable_cache(
  (title: string) => readPublicNewsSearch(anonymousSupabase(), title, Date.now()),
  ["public-news-search-v1"],
  { revalidate: PUBLIC_REVALIDATE.news, tags: ["public-news"] },
);
const article = unstable_cache((slug: string) => readPublicArticle(anonymousSupabase(), slug, Date.now()), ["public-article-v1"], {
  revalidate: PUBLIC_REVALIDATE.news,
  tags: ["public-news"],
});

const rateRows = unstable_cache(() => readBenchmarkRateRows(anonymousSupabase(), BENCHMARK_RATES.map((rate) => rate.name)), ["public-benchmark-rates-v1"], {
  revalidate: PUBLIC_REVALIDATE.rates,
});
const dividendRows = unstable_cache((since: string) => readDividendRows(anonymousSupabase(), since), ["public-dividends-v1"], {
  revalidate: PUBLIC_REVALIDATE.issuer,
});

const luandaDay = (now: number) => civilDate(now);

/** The latest value of each benchmark rate, in picker order. */
export async function getBenchmarkQuotes(now = Date.now()): Promise<BenchmarkQuote[]> {
  return latestBenchmarkQuotes(demo ? demoBenchmarkRateRows(now) : await rateRows());
}

/** Dividends of every issuer paid within the income calendar's window back from today. */
export async function getRecentDividends(now = Date.now()): Promise<IssuerDividend[]> {
  const since = addCivilDays(luandaDay(now), -INCOME_WINDOW_DAYS);
  const rows = demo ? demoDividendRows(now).filter((row) => String(row.payment_date) >= since) : await dividendRows(since);
  return rows.flatMap((row) => decodeIssuerDividend(row) ?? []);
}

export async function getPublicCatalogue(now = Date.now()) {
  const rows: CatalogueRows = demo
    ? { securities: recordedSnapshot.securities, closes: recordedSnapshot.closes }
    : await catalogueRows();
  return publicCatalogue(rows, now);
}

export async function getPublicDailyHistory(securityID: string, now = Date.now()) {
  if (demo) {
    // The recorded closes stay put while the calendar moves: keep the server's one-year bound from today.
    const from = civilDate(now - PUBLIC_HISTORY_DAYS * DAY_MS);
    return pricePoints(demoHistoryRows(securityID, PUBLIC_HISTORY_DAYS).filter((row) => String(row.trading_date) > from));
  }
  return pricePoints(await historyRows(securityID, luandaDay(now)));
}

export async function getPublicPulse(now = Date.now()) {
  return publicPulse(demo ? recordedSnapshot.pulse : await pulseRows(luandaDay(now)));
}

export const getPublicIssuer = (id: string) => (demo ? Promise.resolve(undefined) : issuer(id));
export const getPublicDividend = (id: string) => (demo ? Promise.resolve(undefined) : dividend(id));
export const getPublicReports = (id: string) => (demo ? Promise.resolve([]) : reports(id));

/** A page of published articles, newest first, decoded; `hasMore` comes from one extra row. */
export async function getPublicNews(offset = 0, limit = 20): Promise<{ articles: NewsArticle[]; hasMore: boolean }> {
  if (demo) {
    const rows = demoNewsRows(Date.now());
    return { articles: decodeNewsArticles(rows.slice(offset, offset + limit)), hasMore: rows.length > offset + limit };
  }
  const page = await news(offset, limit);
  return { articles: decodeNewsArticles(page.articles), hasMore: page.hasMore };
}

/** Published articles whose title contains `title`. */
export async function searchPublicNews(title: string): Promise<NewsArticle[]> {
  const query = title.trim();
  if (query === "") return [];
  if (demo) {
    const folded = query.toLocaleLowerCase("pt");
    return decodeNewsArticles(demoNewsRows(Date.now()).filter((row) => String(row.title).toLocaleLowerCase("pt").includes(folded)));
  }
  return decodeNewsArticles(await newsSearch(query));
}

export async function getPublicArticle(slug: string): Promise<NewsArticle | undefined> {
  if (demo) return decodeNewsArticle(demoNewsRows(Date.now()).find((row) => row.slug === slug));
  return decodeNewsArticle(await article(slug));
}
