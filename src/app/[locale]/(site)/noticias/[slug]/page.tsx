import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cache } from "react";

import { requestTime } from "@/data/clock";
import { serverEnv } from "@/config/server-env";
import { getPublicArticle } from "@/data/market/public-cache";
import { ARTICLE_LANGUAGE, ARTICLE_SLUG } from "@/domain/news/article";
import { safeURL } from "@/domain/news/markdown";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { RelatedInstruments } from "@/features/news/related-instruments";
import { ArticleMetadata } from "@/features/news/article-metadata";
import { NewsMarkdown } from "@/features/news/markdown";
import { PAGE_WIDTH } from "@/features/site/chrome";
import { pageMetadata } from "@/features/site/metadata";
import { JsonLd } from "@/features/site/structured-data";
import { getPathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/ui/cn";
import { SectionHeader } from "@/ui/components/layout";
import { ErrorState } from "@/ui/components/states";
import { Icon } from "@/ui/icons/icon";

type Props = { params: Promise<{ locale: string; slug: string }> };

/** `undefined`: not published (404); `null`: the read failed. */
const article = cache(async (slug: string) => (ARTICLE_SLUG.test(slug) ? getPublicArticle(slug).catch(() => null) : undefined));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const found = await article(slug);
  if (!found) return {};
  return pageMetadata({
    locale: locale as AppLocale,
    path: `/noticias/${found.slug}`,
    title: found.title,
    description: found.summary,
    image: "news",
    imageURL: `/og/news/${found.slug}.png`,
    publishedTime: new Date(found.publishedAt).toISOString(),
  });
}

export default async function ArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  const t = await getTranslations();
  const found = await article(slug);
  if (found === undefined) notFound();
  if (found === null) {
    return (
      <main id="main" className={cn(PAGE_WIDTH, "pt-6 pb-16")}>
        <ErrorState title={t("news.article.unavailableTitle")} message={t("news.article.loadFailed")} />
      </main>
    );
  }

  const sources = found.sources.flatMap((source) => {
    const url = safeURL(source.url);
    return url ? [{ ...source, url }] : [];
  });
  const now = requestTime();
  const rows = (await catalogueRows(now)) ?? [];
  const url = `${serverEnv.siteUrl}${getPathname({ locale: locale as AppLocale, href: `/noticias/${found.slug}` })}`;

  return (
    <main id="main" className={cn(PAGE_WIDTH, "pt-6 pb-16")}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: found.title,
          description: found.summary,
          inLanguage: ARTICLE_LANGUAGE,
          datePublished: new Date(found.publishedAt).toISOString(),
          mainEntityOfPage: url,
          url,
          image: [`${serverEnv.siteUrl}/og/news/${found.slug}.png`],
          author: { "@type": "Organization", name: "invest.ao", url: `${serverEnv.siteUrl}/` },
          publisher: { "@type": "Organization", name: "invest.ao", logo: { "@type": "ImageObject", url: `${serverEnv.siteUrl}/brand/palanca.png` } },
          ...(sources.length ? { citation: sources.map((source) => source.url) } : {}),
        }}
      />
      <article className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-4">
          <ArticleMetadata article={found} />
          <h1 lang={ARTICLE_LANGUAGE} className="text-display text-primary-text">
            {found.title}
          </h1>
          <p lang={ARTICLE_LANGUAGE} className="text-body text-secondary-text">
            {found.summary}
          </p>
        </header>
        <hr className="border-separator" />
        <div lang={ARTICLE_LANGUAGE} data-testid="article-body">
          <NewsMarkdown markdown={found.bodyMarkdown ?? ""} />
        </div>
        <hr className="border-separator" />
        <section aria-labelledby="sources" className="flex flex-col gap-1">
          <SectionHeader id="sources" title={t("news.article.sources")} />
          <ul className="flex flex-col">
            {sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  rel="noopener noreferrer external"
                  target="_blank"
                  className="flex min-h-11 items-center justify-between gap-3 rounded-small py-2"
                >
                  <span className="flex flex-col gap-1">
                    <span className="text-body font-medium text-primary-text">{source.name}</span>
                    {source.isPrimary ? <span className="text-caption text-secondary-text">{t("news.article.primarySource")}</span> : null}
                  </span>
                  <Icon name="arrow-up-right" className="text-accent" />
                </a>
              </li>
            ))}
          </ul>
        </section>
        <RelatedInstruments article={found} rows={rows} now={now} />
      </article>
    </main>
  );
}
