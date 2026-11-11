"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname as useRawPathname } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { NewsFeedStore } from "@/data/news/feed-store";
import { routeNewsRepository } from "@/data/news/route-repository";
import { ARTICLE_LANGUAGE, type ArchiveSection, type NewsArticle, archiveSections } from "@/domain/news/article";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/components/buttons";
import { SearchField } from "@/ui/components/controls";
import { SectionHeader } from "@/ui/components/layout";
import { EmptyState, ErrorState, LoadingState } from "@/ui/components/states";

import { ArticleMetadata } from "./article-metadata";

const sleeper = (signal: AbortSignal) => (ms: number) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });

function useMonthTitle() {
  const locale = useLocale();
  return (section: Extract<ArchiveSection, { kind: "month" }>) => {
    const title = new Intl.DateTimeFormat(locale === "pt" ? "pt-AO" : "en-GB", {
      month: "long",
      ...(section.showsYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    }).format(Date.UTC(section.year, section.month - 1, 15));
    return title.charAt(0).toLocaleUpperCase(locale) + title.slice(1);
  };
}

function Archive({ articles, now }: { articles: readonly NewsArticle[]; now: number }) {
  const t = useTranslations();
  const monthTitle = useMonthTitle();
  return archiveSections(articles, now).map((section) => (
    <section key={section.key} aria-labelledby={`news-${section.key}`} className="flex flex-col gap-3">
      <SectionHeader
        id={`news-${section.key}`}
        title={section.kind === "month" ? monthTitle(section) : t(section.kind === "today" ? "common.today" : "common.yesterday")}
      />
      <ul className="flex flex-col rounded-large border-[length:var(--card-outline-width)] border-card-outline bg-card-background px-4">
        {section.articles.map((article) => (
          <li key={article.id} className="border-b border-separator last:border-b-0">
            <Link
              href={`/noticias/${article.slug}`}
              prefetch={false}
              aria-description={t(article.isRecap ? "news.row.recapHint" : "news.row.articleHint")}
              className="flex min-h-11 flex-col gap-3 rounded-small py-4"
              data-testid="news-row"
            >
              <ArticleMetadata article={article} />
              <span lang={ARTICLE_LANGUAGE} className="text-body font-semibold text-primary-text">
                {article.title}
              </span>
              <span lang={ARTICLE_LANGUAGE} className="line-clamp-2 text-secondary text-secondary-text">
                {article.summary}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  ));
}

/**
 * The news archive (iOS `NewsFeedView`): server-rendered first pages, then refreshed every minute in the
 * browser; "Carregar mais" and the title search work as plain links and a GET form without JavaScript.
 */
export function NewsFeed({
  initial,
  hasMore: initialHasMore,
  page,
  query: initialQuery,
  results: initialResults,
  renderedAt,
}: {
  initial: NewsArticle[];
  hasMore: boolean;
  page: number;
  query: string;
  /** Server search results for `query`; null when that search failed. */
  results: NewsArticle[] | null;
  renderedAt: number;
}) {
  const t = useTranslations();
  const pathname = useRawPathname();
  const [store] = useState(() => {
    const created = new NewsFeedStore({ repository: routeNewsRepository });
    created.seed(initial, initialHasMore);
    return created;
  });
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [search, setSearch] = useState(initialQuery);
  const [found, setFound] = useState<{ query: string; articles: NewsArticle[] | null }>({ query: initialQuery.trim(), articles: initialResults });
  const [now, setNow] = useState(renderedAt);
  const query = search.trim();

  useEffect(() => {
    const controller = new AbortController();
    void store.runAutomaticRefresh(sleeper(controller.signal), { immediate: false });
    const clock = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      controller.abort();
      clearInterval(clock);
    };
  }, [store]);

  useEffect(() => {
    if (query === "" || query === found.query) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      routeNewsRepository.search(query, controller.signal).then(
        (articles) => setFound({ query, articles }),
        () => controller.signal.aborted || setFound({ query, articles: null }),
      );
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, found.query]);

  const updateSearch = (value: string) => {
    setSearch(value);
    const params = new URLSearchParams();
    if (value.trim()) params.set("q", value.trim());
    window.history.replaceState(window.history.state, "", params.size ? `?${params}` : window.location.pathname);
  };

  const searching = query !== "" && found.query !== query;
  const visible = useMemo(() => (query === "" ? state.articles : (found.articles ?? [])), [query, state.articles, found.articles]);
  const error = query === "" ? (state.errorKey === "news.store.refreshFailed" && visible.length === 0 ? t(state.errorKey) : null) : found.articles === null && !searching ? t("news.feed.searchFailed") : null;

  return (
    <div className="flex flex-col gap-8">
      <form role="search" action={pathname} onSubmit={(event) => event.preventDefault()}>
        <SearchField name="q" value={search} onChange={updateSearch} placeholder={t("news.feed.searchPrompt")} />
      </form>
      {searching ? (
        <LoadingState message={t("news.feed.loading")} />
      ) : error ? (
        <ErrorState
          title={t("news.feed.unavailableTitle")}
          message={error}
          action={
            <Button kind="secondary" onClick={() => (query === "" ? void store.refresh() : setFound({ query: "", articles: null }))}>
              {t("common.tryAgain")}
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState icon={query === "" ? "news" : "search"} title={query === "" ? t("news.feed.emptyTitle") : t("common.noResults")} />
      ) : null}
      {!searching ? <Archive articles={visible} now={now} /> : null}
      {query === "" && state.hasMore ? (
        <div className="flex flex-col items-center gap-2">
          {state.errorKey === "news.store.loadMoreFailed" ? <p className="text-caption text-secondary-text">{t(state.errorKey)}</p> : null}
          <Link
            href={{ pathname: "/noticias", query: { pagina: String(page + 1) } }}
            prefetch={false}
            scroll={false}
            onClick={(event) => {
              event.preventDefault();
              void store.loadMore();
            }}
            aria-disabled={state.isLoading || undefined}
            className="inline-flex min-h-11 items-center justify-center rounded-medium bg-action-surface px-5 text-body font-semibold text-accent"
          >
            {t("common.loadMore")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
