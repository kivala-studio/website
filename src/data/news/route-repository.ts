import { HttpError } from "@/domain/errors";
import type { NewsArticle } from "@/domain/news/article";

import { withTimeout } from "../http/exact-fetch";
import type { NewsRepository } from "./feed-store";

export const NEWS_ROUTE = "/api/news";

const isArticle = (value: unknown): value is NewsArticle => {
  const article = value as Partial<NewsArticle> | null;
  return (
    typeof article === "object" &&
    article !== null &&
    typeof article.id === "string" &&
    typeof article.slug === "string" &&
    typeof article.title === "string" &&
    typeof article.summary === "string" &&
    typeof article.publishedAt === "number" &&
    Array.isArray(article.sources) &&
    Array.isArray(article.securities)
  );
};

async function read(url: string, signal?: AbortSignal): Promise<NewsArticle[]> {
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: withTimeout(signal) });
  if (!response.ok) throw new HttpError(response.status);
  const body = (await response.json()) as { articles?: unknown };
  if (!Array.isArray(body.articles)) throw new HttpError(502);
  return body.articles.filter(isArticle);
}

/** Published articles through this site's route handler (the server reads Supabase and caches pages). */
export const routeNewsRepository: NewsRepository & { search(title: string, signal?: AbortSignal): Promise<NewsArticle[]> } = {
  articles: (offset, limit, signal) => read(`${NEWS_ROUTE}?offset=${offset}&limit=${limit}`, signal),
  search: (title, signal) => read(`${NEWS_ROUTE}?q=${encodeURIComponent(title)}`, signal),
};
