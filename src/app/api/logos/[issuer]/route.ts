import { getIssuerLogoSource } from "@/data/market/public-cache";
import { isIssuerID, logoImageType, resolvedLogoURL } from "@/domain/market/logo";

/*
 * An issuer's logo from the site's own origin, so pages keep `img-src 'self'` and visitors' browsers never call
 * the issuer's site or the favicon service. The source comes only from the issuer row (curated logo, else the
 * website's favicon), never from the request. Responses are cached by the CDN; the issuer rows by the data cache.
 */

const TIMEOUT_MS = 4000;
const MAX_BYTES = 512 * 1024;

const HIT = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
/** Short enough for a newly added logo to appear within the hour. */
const MISS = "public, max-age=3600, s-maxage=3600";
const FAILURE = "public, max-age=300, s-maxage=300";

const LOCKED = {
  "Content-Security-Policy": "default-src 'none'",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};

const empty = (status: number, cacheControl: string) =>
  new Response(null, { status, headers: { ...LOCKED, "Cache-Control": cacheControl } });

/** The body up to `MAX_BYTES`; `undefined` when it is larger. */
async function boundedBody(response: Response): Promise<Uint8Array | undefined> {
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_BYTES || !response.body) return undefined;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function GET(_request: Request, { params }: { params: Promise<{ issuer: string }> }): Promise<Response> {
  const { issuer } = await params;
  if (!isIssuerID(issuer)) return empty(404, MISS);

  let source: string | undefined;
  try {
    const row = await getIssuerLogoSource(issuer.toLowerCase());
    source = row && resolvedLogoURL(row);
  } catch {
    return empty(503, FAILURE);
  }
  if (!source) return empty(404, MISS);

  try {
    const upstream = await fetch(source, {
      headers: { Accept: "image/webp,image/png,image/jpeg,image/gif,image/x-icon;q=0.9" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // The favicon service answers a generic globe with a 404 when it has nothing for the site.
    const type = logoImageType(upstream.headers.get("content-type"));
    if (!upstream.ok || !type || new URL(upstream.url).protocol !== "https:") {
      await upstream.body?.cancel();
      return empty(404, MISS);
    }
    const body = await boundedBody(upstream);
    if (!body || body.byteLength === 0) return empty(404, MISS);
    return new Response(body as BodyInit, {
      headers: { ...LOCKED, "Content-Type": type, "Content-Length": String(body.byteLength), "Cache-Control": HIT },
    });
  } catch {
    return empty(502, FAILURE);
  }
}
