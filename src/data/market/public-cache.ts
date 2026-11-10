import "server-only";

import { unstable_cache } from "next/cache";

import { publicEnv } from "@/config/public-env";
import { recordedSnapshot } from "@/data/market/demo/scenarios";
import { civilDate, tradingDateNoon } from "@/domain/market/zone";

import { anonymousSupabase } from "../supabase/anonymous-client";
import { pricePoints, readPulseRows } from "./history";
import {
  type CatalogueRows,
  publicCatalogue,
  publicPulse,
  readCatalogueRows,
  readPublicArticle,
  readPublicDividend,
  readPublicHistoryRows,
  readPublicIssuer,
  readPublicNews,
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
const article = unstable_cache((slug: string) => readPublicArticle(anonymousSupabase(), slug, Date.now()), ["public-article-v1"], {
  revalidate: PUBLIC_REVALIDATE.news,
  tags: ["public-news"],
});

const luandaDay = (now: number) => civilDate(now);

export async function getPublicCatalogue(now = Date.now()) {
  const rows: CatalogueRows = demo
    ? { securities: recordedSnapshot.securities, closes: recordedSnapshot.closes }
    : await catalogueRows();
  return publicCatalogue(rows, now);
}

export async function getPublicDailyHistory(securityID: string, now = Date.now()) {
  return pricePoints(demo ? [] : await historyRows(securityID, luandaDay(now)));
}

export async function getPublicPulse(now = Date.now()) {
  return publicPulse(demo ? recordedSnapshot.pulse : await pulseRows(luandaDay(now)));
}

export const getPublicIssuer = (id: string) => (demo ? Promise.resolve(undefined) : issuer(id));
export const getPublicDividend = (id: string) => (demo ? Promise.resolve(undefined) : dividend(id));
export const getPublicReports = (id: string) => (demo ? Promise.resolve([]) : reports(id));
export const getPublicNews = (offset = 0, limit = 20) => (demo ? Promise.resolve({ articles: [], hasMore: false }) : news(offset, limit));
export const getPublicArticle = (slug: string) => (demo ? Promise.resolve(undefined) : article(slug));
