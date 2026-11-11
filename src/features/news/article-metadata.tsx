import { useTranslations } from "next-intl";

import { type NewsArticle, newsKindKey } from "@/domain/news/article";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

/** `Recap diário · 10/11/2026` with the kind's icon (iOS `NewsArticleMetadata`). */
export function ArticleMetadata({ article }: { article: Pick<NewsArticle, "recapPeriod" | "isRecap" | "publishedAt"> }) {
  const t = useTranslations();
  const format = useFormat();
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption font-medium text-secondary-text">
      <span className="inline-flex items-center gap-1">
        <Icon name={article.isRecap ? "chart" : "news"} />
        {t(newsKindKey(article))}
      </span>
      <span aria-hidden>·</span>
      <time dateTime={new Date(article.publishedAt).toISOString()}>{format.date(article.publishedAt)}</time>
    </span>
  );
}
