import { isCancellation } from "@/domain/errors";
import { type EpochMs } from "@/domain/market/zone";
import { type NewsArticle, publicationWindow } from "@/domain/news/article";

/** Published articles, newest first, without bodies. */
export interface NewsRepository {
  articles(offset: number, limit: number, signal?: AbortSignal): Promise<NewsArticle[]>;
  /** Defaults to the first three articles. */
  homeSummaries?(signal?: AbortSignal): Promise<NewsArticle[]>;
}

export type NewsErrorKey = "news.store.refreshFailed" | "news.store.loadMoreFailed";

export interface NewsFeedState {
  readonly articles: readonly NewsArticle[];
  readonly isLoading: boolean;
  readonly hasLoaded: boolean;
  readonly hasMore: boolean;
  readonly errorKey: NewsErrorKey | null;
}

export const NEWS_PAGE_SIZE = 20;
export const NEWS_REFRESH_MS = 60_000;

export type NewsSleep = (ms: number) => Promise<void>;

/**
 * The news archive (iOS `NewsFeedStore`). A refresh re-reads everything already loaded in one
 * request, so a new publication never collapses the archive and an unpublished article disappears;
 * one extra row tells whether older articles remain. Failures keep what is visible.
 */
export class NewsFeedStore {
  private loaded: NewsArticle[] = [];
  private state: NewsFeedState = { articles: [], isLoading: false, hasLoaded: false, hasMore: false, errorKey: null };
  private readonly listeners = new Set<() => void>();
  private readonly repository: NewsRepository;
  private readonly homeSummariesOnly: boolean;
  private readonly now: () => EpochMs;

  constructor(options: { repository: NewsRepository; homeSummariesOnly?: boolean; now?: () => EpochMs }) {
    this.repository = options.repository;
    this.homeSummariesOnly = options.homeSummariesOnly ?? false;
    this.now = options.now ?? Date.now;
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): NewsFeedState => this.state;

  /** Visible articles; the home variant keeps only today's and yesterday's (Luanda). */
  get articles(): NewsArticle[] {
    if (!this.homeSummariesOnly) return this.loaded;
    const { start, end } = publicationWindow(this.now());
    return this.loaded.filter((article) => article.publishedAt >= start && article.publishedAt <= end);
  }

  get hasMore(): boolean {
    return this.state.hasMore;
  }

  get isLoading(): boolean {
    return this.state.isLoading;
  }

  get errorKey(): NewsErrorKey | null {
    return this.state.errorKey;
  }

  /** Server-rendered first page: the browser starts from it instead of reading it again. */
  seed(articles: readonly NewsArticle[], hasMore: boolean): void {
    this.loaded = deduplicated(articles);
    this.patch({ hasMore, hasLoaded: true });
  }

  async refresh(signal?: AbortSignal): Promise<void> {
    if (this.state.isLoading || signal?.aborted) return;
    this.patch({ isLoading: true });
    try {
      if (this.homeSummariesOnly) {
        const summaries = await (this.repository.homeSummaries?.(signal) ?? this.repository.articles(0, 3, signal));
        if (signal?.aborted) return;
        this.loaded = deduplicated(summaries.slice(0, 3));
        this.patch({ hasMore: false, hasLoaded: true, errorKey: null });
        return;
      }
      const limit = Math.max(NEWS_PAGE_SIZE, this.loaded.length);
      const page = await this.repository.articles(0, limit + 1, signal);
      if (signal?.aborted) return;
      this.loaded = deduplicated(page.slice(0, limit));
      this.patch({ hasMore: page.length > limit, hasLoaded: true, errorKey: null });
    } catch (error) {
      if (isCancellation(error) || signal?.aborted) return;
      this.patch({ errorKey: "news.store.refreshFailed" });
    } finally {
      this.patch({ isLoading: false });
    }
  }

  async loadMore(signal?: AbortSignal): Promise<void> {
    if (!this.state.hasMore || this.state.isLoading || signal?.aborted) return;
    this.patch({ isLoading: true });
    try {
      const page = await this.repository.articles(this.loaded.length, NEWS_PAGE_SIZE + 1, signal);
      if (signal?.aborted) return;
      this.loaded = deduplicated([...this.loaded, ...page.slice(0, NEWS_PAGE_SIZE)]);
      this.patch({ hasMore: page.length > NEWS_PAGE_SIZE, errorKey: null });
    } catch (error) {
      if (isCancellation(error) || signal?.aborted) return;
      this.patch({ errorKey: "news.store.loadMoreFailed" });
    } finally {
      this.patch({ isLoading: false });
    }
  }

  /** Refreshes now and every minute until `sleep` throws (the caller aborts it). */
  async runAutomaticRefresh(sleep: NewsSleep, { immediate = true }: { immediate?: boolean } = {}): Promise<void> {
    if (!immediate) {
      try {
        await sleep(NEWS_REFRESH_MS);
      } catch {
        return;
      }
    }
    for (;;) {
      await this.refresh();
      try {
        await sleep(NEWS_REFRESH_MS);
      } catch {
        return;
      }
    }
  }

  private patch(change: Partial<NewsFeedState>): void {
    this.state = { ...this.state, ...change, articles: this.articles };
    for (const listener of this.listeners) listener();
  }
}

function deduplicated(articles: readonly NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  return articles.filter((article) => !seen.has(article.id) && Boolean(seen.add(article.id)));
}
