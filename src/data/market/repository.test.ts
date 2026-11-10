import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { AppError, HttpError } from "@/domain/errors";
import { availableRanges, rangePoints } from "@/domain/market";
import { parseExactJson } from "@/domain/market/exact-json";
import { tradingDateNoon } from "@/domain/market/zone";

import { exactFetch } from "../http/exact-fetch";
import { SupabaseMarketRepository } from "./repository";

/*
 * Ports, against a scripted transport (the iOS `URLProtocol` mocks):
 *   SupabaseErrorBoundaryTests.swift — the nine repository cases (the two boundary cases are in
 *     src/domain/errors/error-boundary.test.ts)
 *   MarketSnapshotRouteTests.swift — 1 case
 * The shared snapshot request goes through the same transport; a body that is not a snapshot
 * (`[]`) is a contract failure that falls through to the direct reads, as on iOS.
 */

type Respond = (url: URL) => { status: number; body: string };

function transport(respond: Respond) {
  const paths: string[] = [];
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    paths.push(url.pathname.split("/").at(-1)!);
    const { status, body } = respond(url);
    return new Response(body, { status, headers: { "content-type": "application/json" } });
  };
  return { paths, fetch };
}

function repository(host: string, respond: Respond, now?: () => number) {
  const { paths, fetch } = transport(respond);
  const client = createClient(`https://${host}`, "test", {
    db: { retry: false },
    global: { fetch: exactFetch(fetch) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const snapshot = async () => {
    const response = await exactFetch(fetch)(`https://${host}/functions/v1/market-snapshot`);
    const text = await response.text();
    if (!response.ok) throw new HttpError(response.status, parseExactJson(text));
    return { json: parseExactJson(text) };
  };
  return { paths, repository: new SupabaseMarketRepository({ snapshot, supabase: () => client, now }) };
}

const last = (url: URL) => url.pathname.split("/").at(-1);
const offsetOf = (url: URL) => Number(url.searchParams.get("offset") ?? "0");
const json = (value: unknown, status = 200) => ({ status, body: JSON.stringify(value) });

/** `trading_date` filters as PostgREST receives them (`gt.`, `gte.`, `lte.`). */
const matchesDateFilters = (url: URL, day: string) =>
  url.searchParams.getAll("trading_date").every((filter) => {
    const [op, value] = [filter.slice(0, filter.indexOf(".")), filter.slice(filter.indexOf(".") + 1)];
    if (op === "gt") return day > value;
    if (op === "gte") return day >= value;
    if (op === "lte") return day <= value;
    return true;
  });

const OVERVIEW = {
  status: "open",
  data_status: "stale",
  source_trading_date: "2026-09-11",
  collected_at: "2026-09-14T09:00:00Z",
  published_at: "2026-09-14T09:00:01Z",
  last_updated_at: "2026-09-14T09:30:00Z",
};

/** iOS `ErrorBoundaryURLProtocol`, per host. */
const boundary =
  (host: string): Respond =>
  (url) => {
    const path = last(url);
    if (path === "market-snapshot") return json([]);
    const partial = host === "partial.invalid" || host === "freshness.invalid";
    // iOS forbids `issuer_financial_reports`, which the web light snapshot never reads; its optional
    // secondary read is the verified closes, so that one is forbidden here and named as unavailable.
    if (host === "partial.invalid" && path === "latest_verified_market_closes") {
      return json({ code: "42501", message: "Denied optional table" }, 403);
    }
    if (path === "get_current_market_quotes") {
      return json(
        partial
          ? { prices: [{ security_id: "NO_TRADES", last_price: 100, trade_count: 0 }], sessions: [], overview: [OVERVIEW] }
          : { prices: [], sessions: [], overview: [] },
      );
    }
    if (host === "capped.invalid" && path === "securities") {
      const start = Math.min(offsetOf(url), 1001);
      const end = Math.min(start + 400, 1001);
      return json(
        Array.from({ length: end - start }, (_, index) => ({
          id: `ID_${start + index}`,
          symbol: `S${start + index}`,
          security_type: "stock",
          currency: "AOA",
          is_active: true,
        })),
      );
    }
    if ((host === "legacy-history.invalid" || host === "malformed-history.invalid") && path === "price_history") {
      return json(
        ["2024-01-02", "2024-12-30", "2026-09-25", "2026-09-28"]
          .filter((day) => matchesDateFilters(url, day))
          .map((day) => ({
            security_id: "AAA",
            trading_date: day,
            close_price: 30000,
            open_price: 30000,
            high_price: host === "malformed-history.invalid" ? 29000 : 31000,
            low_price: 29000,
            volume: 0,
          })),
      );
    }
    if (host === "history-capped.invalid" && path === "price_history") {
      const base = Date.parse("2022-01-01T12:00:00Z");
      const rows = Array.from({ length: 1001 }, (_, index) => new Date(base + index * 86_400_000).toISOString().slice(0, 10))
        .filter((day) => matchesDateFilters(url, day))
        .map((day) => ({ security_id: "AAA", trading_date: day, close_price: 100 }));
      return json(rows.slice(0, 400));
    }
    if (offsetOf(url) !== 0) return json([]);
    if (partial && path === "securities") {
      return json([{ id: "NO_TRADES", symbol: "BAIAAAAA", security_type: "stock", currency: "AOA", is_active: true }]);
    }
    return json([]);
  };

const make = (host: string) => repository(host, boundary(host)).repository;

describe("Supabase error boundary (repository)", () => {
  it("empty public market snapshot does not invent an update time", async () => {
    const snapshot = await make("empty.invalid").fetchLightSnapshot();
    expect(snapshot.securities).toEqual([]);
    expect(snapshot.updatedAt).toBeUndefined();
  });

  it("empty index remains unavailable across both loading phases", async () => {
    const repo = make("empty.invalid");
    const light = await repo.fetchLightSnapshot();
    expect(light.index.value).toBeUndefined();
    expect(light.index.dailyChange).toBeUndefined();
    expect(light.index.percentageChange).toBeUndefined();
    const full = await repo.fetchHistory(light);
    expect(full.index.value).toBeUndefined();
    expect(full.index.dailyChange).toBeUndefined();
    expect(full.index.percentageChange).toBeUndefined();
    expect(full.index.history).toEqual([]);
  });

  it("freshness survives loading and never becomes a security trade time", async () => {
    const repo = make("freshness.invalid");
    const light = await repo.fetchLightSnapshot();
    expect(light.status).toBe("open");
    const metadata = light.sourceMetadata;
    expect(metadata?.dataStatus).toBe("stale");
    expect(metadata?.tradingDate).toBeDefined();
    expect(metadata?.collectedAt).not.toBe(metadata?.publishedAt);
    expect(light.updatedAt).not.toBe(metadata?.publishedAt);
    expect(light.securities).toHaveLength(1);
    expect(light.securities[0].details?.tradeCount).toBe(0);
    expect(light.securities[0].history).toEqual([]);
    const full = await repo.fetchHistory(light);
    expect(full.sourceMetadata).toEqual(metadata);
  });

  it("secondary failure does not discard fresh prices", async () => {
    const snapshot = await make("partial.invalid").fetchLightSnapshot();
    expect(snapshot.securities[0].price.toString()).toBe("100");
    expect(snapshot.updatedAt).toBeDefined();
    expect(snapshot.unavailableSections).toEqual(["market.snapshot.verifiedCloses"]);
  });

  it("lists are complete above the server row cap", async () => {
    const snapshot = await make("capped.invalid").fetchLightSnapshot();
    expect(snapshot.securities).toHaveLength(1001);
    expect(new Set(snapshot.securities.map((security) => security.id)).size).toBe(1001);
  });

  it("history keyset pagination continues past short pages", async () => {
    const points = await make("history-capped.invalid").fetchPriceHistory("AAA");
    expect(points).toHaveLength(1001);
    expect(new Set(points.map((point) => point.date)).size).toBe(1001);
  });

  it("history range includes only requested dates", async () => {
    const points = await make("history-capped.invalid").fetchPriceHistory("AAA", {
      from: Date.parse("2022-02-01T12:00:00Z"),
      through: Date.parse("2022-02-28T12:00:00Z"),
    });
    expect(points).toHaveLength(28);
  });

  it("historical chart includes legacy prices and long ranges", async () => {
    const points = await make("legacy-history.invalid").fetchPriceHistory("AAA");
    expect(points).toHaveLength(4);
    expect(points[0].date).toBe(Date.parse("2024-01-02T12:00:00+01:00"));
    expect(points[0].date).toBe(tradingDateNoon("2024-01-02"));
    expect(points[0].value.toString()).toBe("30000");
    expect(points[0].volume?.toString()).toBe("0");
    expect(availableRanges(points)).toEqual(["1S", "1M", "3M", "6M", "1A", "Tudo"]);
    expect(rangePoints("Tudo", points)).toHaveLength(4);
  });

  it("historical chart preserves reported close without trusting malformed OHLC", async () => {
    const points = await make("malformed-history.invalid").fetchPriceHistory("AAA");
    expect(points).toHaveLength(4);
    expect(points.every((point) => point.value.toString() === "30000")).toBe(true);
    expect(points.every((point) => point.openValue === undefined && point.highValue === undefined && point.lowValue === undefined)).toBe(true);
  });
});

describe("market snapshot route", () => {
  it("a snapshot server failure switches to direct reads until the probe", async () => {
    const start = Date.parse("2026-11-10T10:00:00Z");
    let now = start;
    const { paths, repository: repo } = repository(
      "snapshot-down.invalid",
      (url) => {
        if (last(url) === "market-snapshot") return json({ error: { code: "SNAPSHOT_UNAVAILABLE" }, retry_after_seconds: 30 }, 503);
        if (last(url) === "get_current_market_quotes") return json({ prices: [], sessions: [], overview: [] });
        return json([]);
      },
      () => now,
    );

    const failure = await repo.fetchLightSnapshot().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).httpStatus).toBe(503);
    expect(paths).toEqual(["market-snapshot"]);

    paths.length = 0;
    await repo.fetchLightSnapshot();
    expect(paths).not.toContain("market-snapshot");
    expect(paths).toContain("get_current_market_quotes");

    now = start + 301_000;
    paths.length = 0;
    await repo.fetchLightSnapshot().catch(() => undefined);
    expect(paths).toEqual(["market-snapshot"]);
  });
});
