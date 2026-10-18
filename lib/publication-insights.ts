import type { VerifiedInsight } from "./verified-insights.ts";
import type { Article } from "./public-data";
import type { WrapWindow } from "./wrap-evidence";
import { isUUID } from "./personalisation.ts";
export type InsightArticle = Omit<Article, "news_article_sources"> & {
  news_article_sources: (Article["news_article_sources"][number] & {
    is_primary: boolean;
  })[];
};
async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function publicationInsights(
  articles: InsightArticle[],
  watched: string[],
  period: WrapWindow,
  fetchedAt: number,
  now: number,
): Promise<VerifiedInsight[]> {
  if (fetchedAt > now || now - fetchedAt >= 900000) return [];
  const result: VerifiedInsight[] = [];
  for (const article of articles) {
    if (
      articles.filter((a) => a.id === article.id).length !== 1 ||
      !isUUID(article.id) ||
      !article.title.trim()
    )
      continue;
    const at = Date.parse(article.published_at),
      assets = [
        ...new Set(article.news_article_securities.map((a) => a.securities.id)),
      ]
        .filter((id) => watched.includes(id))
        .sort(),
      primary = article.news_article_sources.filter((s) => s.is_primary);
    if (
      !assets.length ||
      !Number.isFinite(at) ||
      at > fetchedAt ||
      now - at >= 7 * 86400000 ||
      primary.length !== 1 ||
      !primary[0].news_sources.name.trim()
    )
      continue;
    let url: URL;
    try {
      url = new URL(primary[0].source_url);
    } catch {
      continue;
    }
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    )
      continue;
    url.hash = "";
    const normalized = article.title
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLocaleLowerCase("pt-AO")
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .join(" ");
    const allAssets = [
      ...new Set(article.news_article_securities.map((a) => a.securities.id)),
    ].sort();
    const event = `${new Date(at + 3600000).toISOString().slice(0, 10)}:${allAssets.join(",")}:${normalized}`;
    result.push({
      id: `publication:${article.id}`,
      factKeys: [
        `article:${article.id.toLowerCase()}`,
        `article-source:${await hash(url.href)}`,
        `publication-event:${await hash(event)}`,
      ],
      topics: assets.map(
        (id) =>
          `publication:${id}:${new Date(at + 3600000).toISOString().slice(0, 10)}`,
      ),
      assets,
      family: "watchlistInformation",
      category: "watchlist",
      observedAt: at,
      expiresAt: Math.min(fetchedAt + 900000, at + 7 * 86400000),
      significance: 1,
      title: article.title,
      value: "Informação publicada",
      body: article.summary,
      details: [
        { label: "Fonte original", value: primary[0].news_sources.name },
      ],
      recordIDs: [article.id],
      period,
      fetchedAt,
      source: url.href,
      personal: true,
      destination: `/noticias/${article.slug}`,
    });
  }
  return result;
}
