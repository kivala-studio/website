import { getPublicCatalogue, getPublicDailyHistory } from "@/data/market/public-cache";
import { encodePoints } from "@/data/market/history-wire";

/**
 * Public daily history for one listed instrument: verified closes from the last year only (the
 * server read is bounded, whatever the caller asks). Never intraday, never a current price.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const catalogue = await getPublicCatalogue();
  if (!catalogue.some((instrument) => instrument.id === id)) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    const points = await getPublicDailyHistory(id);
    return Response.json({ points: encodePoints(points) }, { headers: { "cache-control": "public, max-age=300" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
