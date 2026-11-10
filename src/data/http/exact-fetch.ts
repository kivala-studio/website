import { quoteInexactNumbers } from "@/domain/market/exact-json";

/** iOS request timeout (`InvestAOSupabase.networkSession`). */
export const REQUEST_TIMEOUT_MS = 20_000;

type Fetch = typeof fetch;

/** The caller's signal bounded by the request timeout. */
export function withTimeout(signal: AbortSignal | null | undefined, timeoutMs = REQUEST_TIMEOUT_MS): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/**
 * `fetch` for supabase-js: one attempt bounded by a timeout, and JSON bodies rewritten so that
 * numeric(24,8) values keep their digits through the SDK's `JSON.parse` (see `quoteInexactNumbers`).
 */
export function exactFetch(base: Fetch = (...args) => fetch(...args), timeoutMs = REQUEST_TIMEOUT_MS): Fetch {
  return async (input, init) => {
    const response = await base(input, { ...init, signal: withTimeout(init?.signal, timeoutMs) });
    if (!/json/i.test(response.headers.get("content-type") ?? "")) return response;
    const text = await response.text();
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    // 204/304 must not carry a body.
    const body = response.status === 204 || response.status === 304 ? null : quoteInexactNumbers(text);
    return new Response(body, { status: response.status, statusText: response.statusText, headers });
  };
}
