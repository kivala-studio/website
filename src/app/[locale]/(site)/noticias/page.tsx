import { getTranslations } from "next-intl/server";

import { requestTime } from "@/data/clock";
import { getPublicNews, searchPublicNews } from "@/data/market/public-cache";
import { NEWS_PAGE_SIZE } from "@/data/news/feed-store";
import type { NewsArticle } from "@/domain/news/article";
import { NewsFeed } from "@/features/news/news-feed";
import { PAGE_WIDTH } from "@/features/site/chrome";
import { siteMetadata } from "@/features/site/metadata";
import { INDEXABLE_PAGES } from "@/features/site/site";
import { AreaMessages } from "@/i18n/area-messages";
import { cn } from "@/ui/cn";
import { PageHeading } from "@/ui/components/layout";
import { ErrorState } from "@/ui/components/states";

export const generateMetadata = siteMetadata({ path: INDEXABLE_PAGES.news, image: "news" }, (t) => ({
  title: t("common.news"),
  description: t("site.meta.newsDescription"),
}));

type Props = { searchParams: Promise<{ pagina?: string | string[]; q?: string | string[] }> };

const MAX_PAGES = 10;

/** `?pagina=N` renders the first N pages (so "Carregar mais" works without JavaScript); `?q=` searches titles. */
export default async function NewsPage({ searchParams }: Props) {
  const t = await getTranslations();
  const params = await searchParams;
  const page = Math.min(MAX_PAGES, Math.max(1, Number.parseInt(typeof params.pagina === "string" ? params.pagina : "1", 10) || 1));
  const query = (typeof params.q === "string" ? params.q : "").trim().slice(0, 100);
  const [feed, results] = await Promise.all([
    getPublicNews(0, page * NEWS_PAGE_SIZE).catch(() => null),
    query ? searchPublicNews(query).catch((): NewsArticle[] | null => null) : Promise.resolve([]),
  ]);

  return (
    <main id="main" className={cn(PAGE_WIDTH, "pt-6 pb-16")}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <PageHeading title={t("common.news")} />
        {feed ? (
          <AreaMessages area="news">
            <NewsFeed initial={feed.articles} hasMore={feed.hasMore} page={page} query={query} results={results} renderedAt={requestTime()} />
          </AreaMessages>
        ) : (
          <ErrorState title={t("news.feed.unavailableTitle")} message={t("news.publications.refreshFailed")} />
        )}
      </div>
    </main>
  );
}
