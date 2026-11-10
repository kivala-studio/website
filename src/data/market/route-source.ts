import { HttpError } from "@/domain/errors";
import { parseExactJson } from "@/domain/market/exact-json";

import { withTimeout } from "../http/exact-fetch";
import type { SnapshotSource } from "./repository";

export const SNAPSHOT_ROUTE = "/api/market/snapshot";

function errorBody(text: string, retryAfter: string | null): unknown {
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON: keep the text; only `retry_after_seconds` is ever read from it.
  }
  const seconds = Number(retryAfter);
  const hasBodyValue = typeof body === "object" && body !== null && "retry_after_seconds" in body;
  if (!hasBodyValue && Number.isFinite(seconds) && seconds > 0) {
    return { ...(typeof body === "object" && body !== null ? body : {}), retry_after_seconds: seconds };
  }
  return body;
}

/**
 * The shared snapshot through this site's route handler; the browser never calls Edge Functions.
 * `no-cache` lets the browser revalidate with `If-None-Match` and reuse the body on 304. A non-2xx
 * throws `HttpError` with the parsed body so `retry_after_seconds` (or `Retry-After`) reaches backoff.
 */
export function routeSnapshotSource(scenario?: string, base: typeof fetch = (...args) => fetch(...args)): SnapshotSource {
  const url = scenario ? `${SNAPSHOT_ROUTE}?scenario=${encodeURIComponent(scenario)}` : SNAPSHOT_ROUTE;
  return async (signal) => {
    const response = await base(url, { cache: "no-cache", headers: { accept: "application/json" }, signal: withTimeout(signal) });
    const text = await response.text();
    if (!response.ok) throw new HttpError(response.status, errorBody(text, response.headers.get("retry-after")));
    return { json: parseExactJson(text), etag: response.headers.get("etag") ?? undefined };
  };
}
