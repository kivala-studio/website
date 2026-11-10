import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import recorded from "../../../tests/fixtures/market/market-snapshot.production.json";
import { publicCatalogue, readCatalogueRows } from "./public";

/** Public pages are cached and shared, so their server reads never carry a current price. */
describe("public market reads", () => {
  it("the catalogue reads no quote and returns no current price", async () => {
    const paths: string[] = [];
    const client = createClient("https://public.invalid", "test", {
      db: { retry: false },
      auth: { persistSession: false },
      global: {
        fetch: async (input) => {
          const url = new URL(String(input));
          paths.push(url.pathname);
          const rows = url.searchParams.get("offset") !== "0" ? [] : url.pathname.endsWith("/securities") ? recorded.securities : recorded.closes;
          return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
        },
      },
    });
    const rows = await readCatalogueRows(client);
    expect(new Set(paths)).toEqual(new Set(["/rest/v1/securities", "/rest/v1/latest_verified_market_closes"]));

    const now = Date.parse(recorded.generated_at);
    const catalogue = publicCatalogue(rows, now);
    expect(catalogue).toHaveLength(recorded.securities.length);
    const allowed = new Set(["id", "symbol", "name", "isin", "currency", "kind", "issuerID", "isListed", "closingPrice"]);
    for (const instrument of catalogue) {
      for (const key of Object.keys(instrument)) expect(allowed, key).toContain(key);
      for (const key of Object.keys(instrument.closingPrice ?? {})) {
        expect(["price", "tradingDate", "confirmedAt", "percentageChange"]).toContain(key);
      }
    }
    // Every close is dated evidence from the verified-close view, never a session price.
    const closes = new Map(recorded.closes.map((row) => [row.security_id, String(row.price)]));
    for (const instrument of catalogue.filter((item) => item.closingPrice)) {
      expect(instrument.closingPrice!.price.toString()).toBe(closes.get(instrument.id));
      expect(instrument.closingPrice!.tradingDate).toBeDefined();
    }
  });
});
