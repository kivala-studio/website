import type Decimal from "decimal.js";

import { foldText, isVisibleOutsideSearch, visibleOutsideSearch } from "./classification";
import type { MarketSecurity, SecurityKind } from "./models";
import { displayPercentageChange, displayPrice, hasDisplayMovement } from "./quote-policy";
import type { EpochMs } from "./zone";

export const MARKET_CATEGORIES = ["all", "equities", "bonds", "funds", "treasury"] as const;
export type MarketCategory = (typeof MARKET_CATEGORIES)[number];

export const MARKET_CATEGORY_LABEL_KEYS: Record<MarketCategory, string> = {
  all: "common.allItems",
  equities: "common.stocks",
  bonds: "common.bonds",
  funds: "common.funds",
  treasury: "markets.category.treasury",
};

const CATEGORY_KIND: Record<Exclude<MarketCategory, "all">, SecurityKind> = {
  equities: "equity",
  bonds: "corporateBond",
  funds: "fund",
  treasury: "treasuryBond",
};

export const categoryIncludesKind = (category: MarketCategory, kind: SecurityKind) =>
  category === "all" || CATEGORY_KIND[category] === kind;

export const categoryIncludes = (category: MarketCategory, security: MarketSecurity) => categoryIncludesKind(category, security.kind);

export const MARKET_SORT_KEYS = ["percentageChange", "price", "volume", "name"] as const;
export type MarketSortKey = (typeof MARKET_SORT_KEYS)[number];

export const MARKET_SORT_LABEL_KEYS: Record<MarketSortKey, string> = {
  percentageChange: "common.change",
  price: "common.price",
  volume: "markets.sort.volume",
  name: "common.name",
};

export type SortDirection = "ascending" | "descending";

export const SORT_DIRECTION_LABEL_KEYS: Record<SortDirection, string> = {
  ascending: "markets.sort.ascending",
  descending: "markets.sort.descending",
};

export interface DiscoveryQuery {
  readonly searchText: string;
  readonly category: MarketCategory;
  readonly sortKey: MarketSortKey;
  readonly direction: SortDirection;
}

export const DEFAULT_DISCOVERY_QUERY: DiscoveryQuery = {
  searchText: "",
  category: "all",
  sortKey: "percentageChange",
  direction: "descending",
};

/** Natural, accent- and case-insensitive ordering, like Finder. */
const collator = new Intl.Collator("pt", { numeric: true, sensitivity: "base" });
export const compareText = (a: string, b: string) => Math.sign(collator.compare(a, b));

const includesFolded = (text: string, query: string) => foldText(text).includes(query);

const compareDecimal = (a: Decimal, b: Decimal) => a.comparedTo(b);

/**
 * Filters by category, search text and visibility (matured bonds never appear, even when searched),
 * then sorts. Price and change sorts put securities without a value last in both directions.
 */
export function applyDiscoveryQuery(
  securities: readonly MarketSecurity[],
  query: Partial<DiscoveryQuery>,
  now: EpochMs,
): MarketSecurity[] {
  const { searchText, category, sortKey, direction } = { ...DEFAULT_DISCOVERY_QUERY, ...query };
  const text = foldText(searchText.trim());
  const matches = (security: MarketSecurity) =>
    text === "" ||
    includesFolded(security.symbol, text) ||
    includesFolded(security.name, text) ||
    includesFolded(security.issuer, text);
  const value = (security: MarketSecurity) =>
    sortKey === "price" ? displayPrice(security, now) : displayPercentageChange(security, now);

  const comesBefore = (lhs: MarketSecurity, rhs: MarketSecurity): boolean => {
    let comparison: number;
    if (sortKey === "price" || sortKey === "percentageChange") {
      const left = value(lhs);
      const right = value(rhs);
      if ((left === undefined) !== (right === undefined)) return left !== undefined;
      comparison = left && right ? compareDecimal(left, right) : 0;
    } else if (sortKey === "volume") comparison = compareDecimal(lhs.volume, rhs.volume);
    else comparison = compareText(lhs.name, rhs.name);
    if (comparison === 0) return compareText(lhs.symbol, rhs.symbol) < 0;
    return direction === "ascending" ? comparison < 0 : comparison > 0;
  };

  return securities
    .filter((security) => categoryIncludes(category, security) && matches(security) && isVisibleOutsideSearch(security, now))
    .sort((a, b) => (comesBefore(a, b) ? -1 : comesBefore(b, a) ? 1 : 0));
}

/** Search terms per kind, from the message catalogue: `(kind) => [t(kindLabelKey(kind)), …]`. */
export type KindSearchTerms = (kind: SecurityKind) => readonly string[];

/** Keys whose translations name each kind in search (equities also answer to the legacy spelling). */
export const KIND_SEARCH_KEYS: Record<SecurityKind, readonly string[]> = {
  corporateBond: ["market.kind.corporateBond"],
  equity: ["common.stock", "search.filter.stock"],
  fund: ["market.kind.fundUnit"],
  other: ["market.kind.otherInstrument"],
  treasuryBond: ["market.kind.treasuryBond"],
};

export const kindSearchTerms =
  (translate: (key: string) => string): KindSearchTerms =>
  (kind) =>
    KIND_SEARCH_KEYS[kind].map((key) => translate(key));

function relevance(security: MarketSecurity, query: string, kindTerms: KindSearchTerms): number | undefined {
  const symbol = foldText(security.symbol.trim());
  const name = foldText(security.name.trim());
  const issuer = foldText(security.issuer.trim());
  if (symbol === query) return 0;
  if (symbol.startsWith(query)) return 1;
  if (symbol.includes(query)) return 2;
  if (name.startsWith(query)) return 3;
  if (name.includes(query)) return 4;
  if (issuer.startsWith(query)) return 5;
  if (issuer.includes(query)) return 6;
  // "Ação" is also the end of "obrigação": the bare type word stays specific to equities.
  if (query === "acao") return security.kind === "equity" ? 7 : undefined;
  return foldText(kindTerms(security.kind).join("")).includes(query) ? 7 : undefined;
}

/** Global search: ticker, name, issuer, then kind; exact tickers first. Matured bonds never match. */
export function searchSecurities(
  securities: readonly MarketSecurity[],
  text: string,
  options: { now: EpochMs; kindTerms: KindSearchTerms },
): MarketSecurity[] {
  const query = foldText(text.trim());
  if (query === "") return [];
  return visibleOutsideSearch(securities, options.now)
    .flatMap((security) => {
      const score = relevance(security, query, options.kindTerms);
      return score === undefined ? [] : [{ security, score }];
    })
    .sort((a, b) => a.score - b.score || compareText(a.security.symbol, b.security.symbol))
    .map(({ security }) => security);
}

export const RECENT_SEARCH_LIMIT = 8;

/** Most recent first, unique, at most eight. */
export function recordRecentSearch(ids: readonly string[], id: string): string[] {
  if (id === "") return [...ids];
  return [id, ...ids.filter((item) => item !== id)].slice(0, RECENT_SEARCH_LIMIT);
}

export interface MarketMovers {
  readonly gains: MarketSecurity[];
  readonly losses: MarketSecurity[];
  readonly gainCount: number;
  readonly lossCount: number;
}

/** Top gains and losses by displayed BODIVA variation, among securities with a usable movement. */
export function marketMovers(securities: readonly MarketSecurity[], now: EpochMs, limit = 3): MarketMovers {
  const movers = securities.flatMap((security) => {
    const change = displayPercentageChange(security, now);
    return hasDisplayMovement(security, now) && change ? [{ security, change }] : [];
  });
  const ranked = (sign: 1 | -1) =>
    movers
      .filter(({ change }) => change.comparedTo(0) === sign)
      .sort((a, b) => sign * b.change.comparedTo(a.change) || compareText(a.security.symbol, b.security.symbol))
      .map(({ security }) => security);
  const gains = ranked(1);
  const losses = ranked(-1);
  return { gains: gains.slice(0, limit), losses: losses.slice(0, limit), gainCount: gains.length, lossCount: losses.length };
}
