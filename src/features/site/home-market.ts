import "server-only";

import { type MarketCategory, applyDiscoveryQuery, marketSecurity, securityDisplayName } from "@/domain/market";
import { catalogueRows } from "@/features/market/browse/catalogue";
import type { CatalogueRow } from "@/features/market/browse/price-cell";

/** The kinds the landing page offers, in the market list's order. */
export const HOME_CATEGORIES = ["equities", "bonds", "funds", "treasury"] as const satisfies readonly MarketCategory[];
export type HomeCategory = (typeof HOME_CATEGORIES)[number];

const PREVIEW_ROWS = 5;

export type PreviewRow = { row: CatalogueRow; name?: string };

export type HomeMarket = {
  /** Visible instruments across every kind. */
  total: number;
  /** Kinds with at least one visible instrument, each with its visible count and first rows. */
  categories: { category: HomeCategory; count: number; rows: PreviewRow[] }[];
};

/**
 * The landing page's market preview from the same cached catalogue and server path as `/mercado`: each kind in the
 * market list's server order (instruments with a dated verified close first), never a current quote.
 * `null` when the catalogue cannot be read.
 */
export async function homeMarket(now: number): Promise<HomeMarket | null> {
  const rows = await catalogueRows(now);
  if (!rows) return null;
  const byID = new Map(rows.map((row) => [row.id, row]));
  const securities = rows.map((row) =>
    marketSecurity({ id: row.id, symbol: row.symbol, kind: row.kind, name: row.name, issuer: row.issuer, quoteAvailability: "unavailable" }),
  );
  const categories = HOME_CATEGORIES.map((category) => {
    const visible = applyDiscoveryQuery(securities, { category }, now).map((security) => ({
      row: byID.get(security.id)!,
      name: securityDisplayName(security),
    }));
    const preview = [...visible.filter(({ row }) => row.close), ...visible.filter(({ row }) => !row.close)].slice(0, PREVIEW_ROWS);
    return { category, count: visible.length, rows: preview };
  }).filter(({ rows: preview }) => preview.length > 0);
  return { total: applyDiscoveryQuery(securities, { category: "all" }, now).length, categories };
}
