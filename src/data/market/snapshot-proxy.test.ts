import { describe, expect, it } from "vitest";

import { createSnapshotProxy } from "./snapshot-proxy";

/*
 * `GET /api/market/snapshot` against a scripted upstream. The route-switching case of iOS
 * `MarketSnapshotRouteTests` runs through the repository in repository.test.ts; these cases cover
 * what the proxy itself adds: the max-age cache, conditional requests and failure passthrough.
 */

const URL = "https://project.invalid/functions/v1/market-snapshot";
const BODY = '{"generated_at":"2026-11-10T22:45:30Z"}';
const OK_HEADERS = {
  "content-type": "application/json",
  "cache-control": "public, max-age=118, stale-while-revalidate=5",
  etag: 'W/"v1"',
  "x-investao-generated-at": "2026-11-10T22:45:30Z",
};

function upstream(responses: (() => Response)[]) {
  const requests: Headers[] = [];
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    requests.push(new Headers(init?.headers));
    const next = responses.shift();
    if (!next) throw new Error("unexpected upstream request");
    return next();
  };
  return { requests, fetch };
}

const request = (headers: Record<string, string> = {}) => new Request("http://localhost/api/market/snapshot", { headers });

describe("market snapshot proxy", () => {
  it("a second request within max-age does not reach the upstream, and a matching ETag gets a 304", async () => {
    let now = 0;
    const { requests, fetch } = upstream([() => new Response(BODY, { status: 200, headers: OK_HEADERS })]);
    const handle = createSnapshotProxy({ url: URL, key: "publishable", fetch, now: () => now });

    const [first, concurrent] = await Promise.all([handle(request()), handle(request())]);
    expect(first.status).toBe(200);
    expect(await first.text()).toBe(BODY);
    expect(await concurrent.text()).toBe(BODY);
    expect(first.headers.get("etag")).toBe('W/"v1"');
    expect(first.headers.get("cache-control")).toBe("public, max-age=118, s-maxage=118, stale-while-revalidate=5");
    expect(first.headers.get("x-investao-generated-at")).toBe("2026-11-10T22:45:30Z");
    expect(requests).toHaveLength(1);
    expect(requests[0].get("apikey")).toBe("publishable");
    expect(requests[0].has("authorization")).toBe(false);

    now = 100_000;
    const revalidated = await handle(request({ "if-none-match": '"v1"' }));
    expect(revalidated.status).toBe(304);
    expect(revalidated.headers.get("cache-control")).toBe("public, max-age=18, s-maxage=18, stale-while-revalidate=5");
    expect(requests).toHaveLength(1);
  });

  it("after max-age the upstream is revalidated with If-None-Match and a 304 keeps the body", async () => {
    let now = 0;
    const { requests, fetch } = upstream([
      () => new Response(BODY, { status: 200, headers: OK_HEADERS }),
      () => new Response(null, { status: 304, headers: { "cache-control": OK_HEADERS["cache-control"], etag: 'W/"v1"' } }),
    ]);
    const handle = createSnapshotProxy({ url: URL, key: "publishable", fetch, now: () => now });
    await handle(request());
    now = 118_000;
    const response = await handle(request());
    expect(requests).toHaveLength(2);
    expect(requests[1].get("if-none-match")).toBe('W/"v1"');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(BODY);
    expect(response.headers.get("cache-control")).toContain("max-age=118");
  });

  it("an upstream failure passes through uncached with Retry-After", async () => {
    const failure = '{"error":{"code":"SNAPSHOT_UNAVAILABLE"},"retry_after_seconds":30}';
    const { requests, fetch } = upstream([
      () => new Response(failure, { status: 503, headers: { "content-type": "application/json" } }),
      () => new Response(BODY, { status: 200, headers: OK_HEADERS }),
    ]);
    const handle = createSnapshotProxy({ url: URL, key: "publishable", fetch, now: () => 0 });
    const response = await handle(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe(failure);
    expect((await handle(request())).status).toBe(200);
    expect(requests).toHaveLength(2);
  });
});
