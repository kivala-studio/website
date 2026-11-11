import type { DiscoveryQuery, MarketCategory, MarketSortKey, SortDirection } from "@/domain/market";

/*
 * The market list's filter and sort live in the URL, with Portuguese values in both languages:
 * `/mercado?categoria=obrigacoes&ordem=preco&sentido=asc&q=bfa`. Defaults are left out, so the
 * canonical `/mercado` is the iOS default (Ações, Variação, descending).
 */

const CATEGORY_SLUGS: Record<MarketCategory, string> = {
  all: "todos",
  equities: "acoes",
  bonds: "obrigacoes",
  funds: "fundos",
  treasury: "tesouro",
};
const SORT_SLUGS: Record<MarketSortKey, string> = { percentageChange: "variacao", price: "preco", volume: "volume", name: "nome" };
const DIRECTION_SLUGS: Record<SortDirection, string> = { ascending: "asc", descending: "desc" };

export const MARKET_DEFAULT_QUERY: DiscoveryQuery = { searchText: "", category: "equities", sortKey: "percentageChange", direction: "descending" };

const fromSlug = <T extends string>(slugs: Record<T, string>, value: string | null, fallback: T): T =>
  (Object.keys(slugs) as T[]).find((key) => slugs[key] === value) ?? fallback;

type Params = { get(name: string): string | null };

export function readMarketQuery(params: Params): DiscoveryQuery {
  return {
    searchText: (params.get("q") ?? "").slice(0, 100),
    category: fromSlug(CATEGORY_SLUGS, params.get("categoria"), MARKET_DEFAULT_QUERY.category),
    sortKey: fromSlug(SORT_SLUGS, params.get("ordem"), MARKET_DEFAULT_QUERY.sortKey),
    direction: fromSlug(DIRECTION_SLUGS, params.get("sentido"), MARKET_DEFAULT_QUERY.direction),
  };
}

/** Query-string object for links; defaults and an empty search are omitted. */
export function marketQueryParams(query: DiscoveryQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.category !== MARKET_DEFAULT_QUERY.category) params.categoria = CATEGORY_SLUGS[query.category];
  if (query.sortKey !== MARKET_DEFAULT_QUERY.sortKey) params.ordem = SORT_SLUGS[query.sortKey];
  if (query.direction !== MARKET_DEFAULT_QUERY.direction) params.sentido = DIRECTION_SLUGS[query.direction];
  if (query.searchText.trim() !== "") params.q = query.searchText.trim();
  return params;
}
