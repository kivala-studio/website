import { retryAfterFromBody } from "@/domain/errors";
import { type EpochMs, SECOND_MS } from "@/domain/market/zone";

import { REQUEST_TIMEOUT_MS } from "../http/exact-fetch";

/** Edge revalidation window the upstream allows (contract §9.1 sends `stale-while-revalidate=5`). */
const STALE_WHILE_REVALIDATE = 5;

interface Entry {
  readonly body: string;
  readonly etag: string | null;
  readonly generatedAt: string | null;
  readonly expiresAt: EpochMs;
}

const maxAge = (cacheControl: string | null) => {
  const match = /(?:^|,)\s*max-age=(\d+)/i.exec(cacheControl ?? "");
  return match ? Number(match[1]) : 0;
};

/** RFC 9110 weak comparison: `W/"x"` matches `"x"`; `*` matches any representation. */
function matches(ifNoneMatch: string | null, etag: string | null): boolean {
  if (!ifNoneMatch || !etag) return false;
  const opaque = (tag: string) => tag.trim().replace(/^W\//, "");
  return ifNoneMatch.split(",").some((tag) => tag.trim() === "*" || opaque(tag) === opaque(etag));
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

class UpstreamError {
  constructor(readonly response: Response) {}
}

/**
 * `GET /api/market/snapshot`: the only path from the browser to the `market-snapshot` Edge Function.
 * The body is kept in memory for the upstream `max-age` (a request inside that window never reaches
 * the upstream), revalidated with `If-None-Match`, and concurrent misses share one upstream request.
 * Clients get the `ETag`, a 304 when theirs matches, and `Cache-Control` for the remaining age.
 * Failures are passed through uncached with `Retry-After`; nothing is retried here.
 */
export function createSnapshotProxy(options: {
  url: string;
  key: string;
  fetch?: typeof fetch;
  now?: () => EpochMs;
  timeoutMs?: number;
}) {
  const send = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const now = options.now ?? Date.now;
  let entry: Entry | undefined;
  let inflight: Promise<Entry> | undefined;

  async function revalidate(): Promise<Entry> {
    const headers: Record<string, string> = { apikey: options.key, accept: "application/json" };
    if (entry?.etag) headers["if-none-match"] = entry.etag;
    let response: Response;
    try {
      response = await send(options.url, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      throw new UpstreamError(json(timedOut ? 504 : 502, { error: { code: timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNREACHABLE" } }));
    }
    const age = maxAge(response.headers.get("cache-control"));
    if (response.status === 304 && entry) {
      entry = { ...entry, expiresAt: now() + age * SECOND_MS };
      return entry;
    }
    const body = await response.text();
    if (response.status !== 200) {
      const retryAfter = response.headers.get("retry-after") ?? retryAfterFromBody(body)?.toString();
      throw new UpstreamError(
        new Response(body, {
          status: response.status,
          headers: {
            "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
            "cache-control": "no-store",
            ...(retryAfter ? { "retry-after": retryAfter } : {}),
          },
        }),
      );
    }
    entry = {
      body,
      etag: response.headers.get("etag"),
      generatedAt: response.headers.get("x-investao-generated-at"),
      expiresAt: now() + age * SECOND_MS,
    };
    return entry;
  }

  return async function handle(request: Request): Promise<Response> {
    let current = entry && now() < entry.expiresAt ? entry : undefined;
    if (!current) {
      inflight ??= revalidate().finally(() => {
        inflight = undefined;
      });
      try {
        current = await inflight;
      } catch (error) {
        if (error instanceof UpstreamError) return error.response.clone();
        throw error;
      }
    }
    const remaining = Math.max(0, Math.floor((current.expiresAt - now()) / SECOND_MS));
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${remaining}, s-maxage=${remaining}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
    };
    if (current.etag) headers.etag = current.etag;
    if (current.generatedAt) headers["x-investao-generated-at"] = current.generatedAt;
    if (matches(request.headers.get("if-none-match"), current.etag)) return new Response(null, { status: 304, headers });
    return new Response(current.body, { status: 200, headers });
  };
}
