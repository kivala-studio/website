import { ARTICLE_LANGUAGE, type NewsArticle } from "@/domain/news/article";
import type { Format } from "@/domain/format";
import { Link } from "@/i18n/navigation";
import { SectionHeader } from "@/ui/components/layout";
import { Icon } from "@/ui/icons/icon";

/** Home and market information `Notícias`: up to three publications, a link to the archive. */
export function Publications({
  articles,
  format,
  title,
  unavailable,
  kind,
  id = "home-news",
}: {
  articles: readonly NewsArticle[] | null;
  format: Format;
  title: string;
  unavailable: string;
  kind: (article: NewsArticle) => string;
  /** Unique per page: the heading id and test id. */
  id?: string;
}) {
  if (articles?.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2 lg:panel lg:gap-0 lg:px-4 lg:py-3" data-testid={id}>
      <SectionHeader
        id={id}
        title={title}
        action={
          <Link href="/noticias" aria-label={title} className="inline-flex size-11 items-center justify-center rounded-full text-accent">
            <Icon name="arrow-right" />
          </Link>
        }
      />
      {articles === null ? (
        <p className="text-secondary text-secondary-text">{unavailable}</p>
      ) : (
        <ul className="flex flex-col">
          {articles.map((article) => (
            <li key={article.id} className="border-b border-separator last:border-b-0 lg:border-hairline">
              <Link href={`/noticias/${article.slug}`} className="flex flex-col gap-2 rounded-small py-3 desk:gap-1 desk:py-2.5">
                <span lang={ARTICLE_LANGUAGE} className="line-clamp-2 text-body font-semibold text-primary-text">
                  {article.title}
                </span>
                <span className="text-caption text-secondary-text">
                  {kind(article)} · <time dateTime={new Date(article.publishedAt).toISOString()}>{format.date(article.publishedAt)}</time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
