import { getPublicArticle } from "@/data/market/public-cache";
import { ARTICLE_SLUG } from "@/domain/news/article";
import { ogCard } from "@/features/site/og-card";

// Open Graph card of one article, with its title in the language it was written in: /og/news/{slug}.png
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug.replace(/\.png$/, "");
  const article = ARTICLE_SLUG.test(slug) ? await getPublicArticle(slug).catch(() => undefined) : undefined;
  if (!article) return new Response(null, { status: 404 });
  const image = await ogCard({ appName: "invest.ao", title: article.title });
  image.headers.set("cache-control", "public, max-age=3600");
  return image;
}
