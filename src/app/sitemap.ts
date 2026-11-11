import type { MetadataRoute } from "next";

import { serverEnv } from "@/config/server-env";
import { getPublicCatalogue, getPublicNews } from "@/data/market/public-cache";
import { isVisibleOutsideSearch, marketSecurity } from "@/domain/market";
import { LESSONS } from "@/features/learn/lessons";
import { INDEXABLE_PAGES } from "@/features/site/site";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type Entry = { path: string; changeFrequency: "daily" | "weekly" | "monthly"; priority: number; lastModified?: Date };

/** Rebuilt hourly: new articles and instruments appear without a deploy. */
export const revalidate = 3600;

/** Most recent articles listed; older ones stay reachable from the archive. */
const SITEMAP_ARTICLES = 500;

async function instruments(now: number): Promise<Entry[]> {
  try {
    return (await getPublicCatalogue(now))
      .filter((instrument) => isVisibleOutsideSearch(marketSecurity({ id: instrument.id, symbol: instrument.symbol, kind: instrument.kind, isListed: instrument.isListed }), now))
      .map((instrument) => ({ path: `/mercado/${encodeURIComponent(instrument.symbol)}`, changeFrequency: "daily", priority: 0.6 }));
  } catch {
    return [];
  }
}

async function articles(): Promise<Entry[]> {
  try {
    return (await getPublicNews(0, SITEMAP_ARTICLES)).articles.map((article) => ({
      path: `/noticias/${article.slug}`,
      changeFrequency: "monthly",
      priority: 0.4,
      lastModified: new Date(article.publishedAt),
    }));
  } catch {
    return [];
  }
}

/**
 * Public, indexable pages only, each in both languages with its hreflang alternates: the fixed pages,
 * every visible instrument, the lessons and recent articles. Share links and invite codes never appear.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const absolute = (locale: (typeof routing.locales)[number], path: string) => `${serverEnv.siteUrl}${getPathname({ locale, href: path })}`;
  const fixed: Entry[] = Object.values(INDEXABLE_PAGES).map((path) => ({
    path,
    changeFrequency: path === INDEXABLE_PAGES.home ? "weekly" : path === INDEXABLE_PAGES.market || path === INDEXABLE_PAGES.news ? "daily" : "monthly",
    priority: path === INDEXABLE_PAGES.home ? 1 : 0.5,
  }));
  const lessons: Entry[] = LESSONS.map((lesson) => ({ path: `/aprender/${lesson.slug}`, changeFrequency: "monthly", priority: 0.4 }));
  const entries = [...fixed, ...(await instruments(Date.now())), ...lessons, ...(await articles())];

  return entries.flatMap(({ path, ...entry }) => {
    const languages = Object.fromEntries(routing.locales.map((locale) => [locale, absolute(locale, path)]));
    return routing.locales.map((locale) => ({ url: absolute(locale, path), ...entry, alternates: { languages } }));
  });
}
