import { getPublicNews, searchPublicNews } from "@/data/market/public-cache";

const MAX_LIMIT = 201;

/** Published articles without bodies: `?offset=&limit=` pages (newest first) or `?q=` title search. */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  try {
    const query = params.get("q");
    if (query !== null) {
      return Response.json({ articles: await searchPublicNews(query.slice(0, 100)) }, { headers: { "cache-control": "public, max-age=60" } });
    }
    const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(params.get("limit") ?? "21", 10) || 21));
    const { articles } = await getPublicNews(offset, limit);
    return Response.json({ articles }, { headers: { "cache-control": "public, max-age=60" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
