import { getLocale, getTranslations } from "next-intl/server";

import { getPublicNews } from "@/data/market/public-cache";
import { type FormatLocale, createFormat } from "@/domain/format";
import { newsKindKey } from "@/domain/news/article";
import { MarketInformationView } from "@/features/news/market-information";
import { Publications } from "@/features/news/publications";
import { PageHeading } from "@/ui/components/layout";

import type { Metadata } from "next";

const NEWS_LIMIT = 3;

/** No live source sends market information yet, so the page is never indexed. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("common.marketInformation"), robots: { index: false } };
}

/** `/mercado/informacao` (iOS `MarketInformationView`): publications, then the market's own notices. */
export default async function MarketInformationPage() {
  const t = await getTranslations();
  const format = createFormat((await getLocale()) as FormatLocale, (key, values) => t(key as never, values as never));
  const news = await getPublicNews(0, NEWS_LIMIT).catch(() => null);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeading title={t("common.marketInformation")} />
      <Publications
        id="market-information-news"
        articles={news?.articles ?? null}
        format={format}
        title={t("common.news")}
        unavailable={t("components.placeholder.loadFailed")}
        kind={(article) => t(newsKindKey(article))}
      />
      <MarketInformationView />
    </div>
  );
}
