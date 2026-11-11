import { DAY_MS, type EpochMs, civilDate, parseInstant, startOfDay } from "../market/zone";

/*
 * A published article or market recap (iOS `NewsArticle`), decoded from the PostgREST select with
 * its categories, sources and related securities. JSON-safe so server pages can hand it to the browser.
 */

export interface NewsSource {
  readonly url: string;
  readonly title?: string;
  readonly isPrimary: boolean;
  readonly name: string;
}

export interface NewsSecurityLink {
  readonly id: string;
  readonly symbol: string;
  readonly name?: string;
}

export interface NewsArticle {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  /** Only detail reads carry the body; list reads omit it. */
  readonly bodyMarkdown?: string;
  readonly publishedAt: EpochMs;
  readonly recapPeriod?: string;
  readonly recapTradingDate?: string;
  readonly isRecap: boolean;
  readonly categories: readonly string[];
  readonly sources: readonly NewsSource[];
  readonly securities: readonly NewsSecurityLink[];
}

/** Articles are written in Portuguese and never translated (contract §3); English pages mark them as such. */
export const ARTICLE_LANGUAGE = "pt-AO";

/** Slugs the site looks up; anything else is not found without a read. */
export const ARTICLE_SLUG = /^[\p{L}\p{N}_-]{1,200}$/u;

type Row = Record<string, unknown>;
const record = (value: unknown): Row | undefined => (value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Row) : undefined);
const text = (value: unknown) => (typeof value === "string" ? value : undefined);
const list = (value: unknown) => (Array.isArray(value) ? value : []);
/** To-one embeds arrive as an object (or a one-element array on some relationships). */
const embed = (value: unknown) => record(Array.isArray(value) ? value[0] : value);

/** One row of the news select, or undefined when a required field is missing or malformed. */
export function decodeNewsArticle(value: unknown): NewsArticle | undefined {
  const row = record(value);
  if (!row) return undefined;
  const [id, slug, title, summary] = [text(row.id), text(row.slug), text(row.title), text(row.summary)];
  const publishedAt = parseInstant(text(row.published_at));
  if (!id || !slug || title === undefined || summary === undefined || publishedAt === undefined) return undefined;
  const recap = embed(row.market_recaps);
  const recapPeriod = text(row.recap_period);
  return {
    id,
    slug,
    title,
    summary,
    bodyMarkdown: text(row.body_markdown),
    publishedAt,
    recapPeriod,
    recapTradingDate: text(recap?.trading_date),
    isRecap: recap !== undefined || recapPeriod !== undefined,
    categories: list(row.news_article_categories).flatMap((link) => {
      const name = text(embed(record(link)?.news_categories)?.name);
      return name ? [name] : [];
    }),
    sources: list(row.news_article_sources).flatMap((link): NewsSource[] => {
      const source = record(link);
      const url = text(source?.source_url);
      const name = text(embed(source?.news_sources)?.name);
      if (!source || !url || !name) return [];
      return [{ url, name, title: text(source.source_title), isPrimary: source.is_primary === true }];
    }),
    securities: list(row.news_article_securities).flatMap((link): NewsSecurityLink[] => {
      const security = embed(record(link)?.securities);
      const [securityID, symbol] = [text(security?.id), text(security?.symbol)];
      return securityID && symbol ? [{ id: securityID.toLowerCase(), symbol, name: text(security?.name) }] : [];
    }),
  };
}

export const decodeNewsArticles = (rows: unknown): NewsArticle[] =>
  (Array.isArray(rows) ? rows : []).flatMap((row) => {
    const article = decodeNewsArticle(row);
    return article ? [article] : [];
  });

export type NewsKindKey = "news.kind.article" | "news.kind.dailyRecap" | "news.kind.weeklyRecap" | "news.kind.monthlyRecap" | "news.kind.annualRecap";

export function newsKindKey(article: Pick<NewsArticle, "recapPeriod" | "isRecap">): NewsKindKey {
  switch (article.recapPeriod) {
    case "weekly":
      return "news.kind.weeklyRecap";
    case "monthly":
      return "news.kind.monthlyRecap";
    case "annual":
      return "news.kind.annualRecap";
    default:
      return article.isRecap ? "news.kind.dailyRecap" : "news.kind.article";
  }
}

/** Home and insights keep today's and yesterday's publications (Luanda days); the archive keeps all. */
export function publicationWindow(now: EpochMs): { start: EpochMs; end: EpochMs } {
  return { start: startOfDay(now) - DAY_MS, end: now };
}

export type ArchiveSection =
  | { readonly key: string; readonly kind: "today" | "yesterday"; readonly articles: NewsArticle[] }
  | { readonly key: string; readonly kind: "month"; readonly year: number; readonly month: number; readonly showsYear: boolean; readonly articles: NewsArticle[] };

/** Today and yesterday stay separate; older publications group by month, newest first. */
export function archiveSections(articles: readonly NewsArticle[], now: EpochMs): ArchiveSection[] {
  const today = startOfDay(now);
  const yesterday = today - DAY_MS;
  const currentYear = Number(civilDate(now).slice(0, 4));
  const groups = new Map<string, { start: EpochMs; section: ArchiveSection }>();
  for (const article of articles) {
    const day = startOfDay(article.publishedAt);
    const date = civilDate(article.publishedAt);
    const [year, month] = [Number(date.slice(0, 4)), Number(date.slice(5, 7))];
    const key = day >= today ? "today" : day >= yesterday ? "yesterday" : date.slice(0, 7);
    let group = groups.get(key);
    if (!group) {
      const section: ArchiveSection =
        key === "today" || key === "yesterday"
          ? { key, kind: key, articles: [] }
          : { key, kind: "month", year, month, showsYear: year !== currentYear, articles: [] };
      group = { start: key === "today" ? today : key === "yesterday" ? yesterday : Date.UTC(year, month - 1, 1), section };
      groups.set(key, group);
    }
    group.section.articles.push(article);
  }
  return [...groups.values()]
    .sort((a, b) => b.start - a.start)
    .map(({ section }) => {
      section.articles.sort((a, b) => b.publishedAt - a.publishedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
      return section;
    });
}
