import { MARKET_MESSAGE_KEYS, type MarketSecurity, type SecurityKind } from "./models";
import { type EpochMs, LUANDA, dayStart, startOfDay } from "./zone";

/** Case- and accent-insensitive form used for matching: `Acção` → `accao`, `Ação` → `acao`. */
export const foldText = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt");

const TREASURY_SYMBOL = /^[BO][A-Z][0-9]{2}[A-Z0-9]{4}$/;
const CORPORATE_BOND_SYMBOL = /^[A-Z0-9]{4}DOF[A-Z0-9]$/;
const FUND_SYMBOL = /^[A-Z0-9]{4}UFV[A-Z0-9]$/;
const EQUITY_SYMBOL = /^(?:[A-Z]{3}A{5}|[A-Z]{4}A{4})$/;

/** BODIVA symbol patterns take priority; the backend type and the name recover missing metadata. */
export function classifySecurityKind(input: { type: string; name?: string; symbol: string }): SecurityKind {
  const text = foldText(`${input.type} ${input.name ?? ""}`);
  const symbol = input.symbol.trim().toUpperCase();
  if (symbol.startsWith("OT-") || TREASURY_SYMBOL.test(symbol)) return "treasuryBond";
  if (CORPORATE_BOND_SYMBOL.test(symbol)) return "corporateBond";
  if (FUND_SYMBOL.test(symbol)) return "fund";
  if (EQUITY_SYMBOL.test(symbol)) return "equity";
  const has = (...terms: string[]) => terms.some((term) => text.includes(term));
  if (has("treasury_bond", "tesouro", "bilhete", "bt-", "ot-")) return "treasuryBond";
  if (has("corporate_bond", "obrig", "bond", "instrumento de divida")) return "corporateBond";
  if (has("fund", "fundo", "unidade de participacao")) return "fund";
  if (has("stock", "equity", "accao", "accoes", "acoes")) return "equity";
  return "other";
}

export const isBondKind = (kind: SecurityKind) => kind === "corporateBond" || kind === "treasuryBond";

/** Bond prices and their changes are a percentage of par (and points); everything else is currency. */
export const priceUnit = (kind: SecurityKind): "currency" | "percentOfPar" => (isBondKind(kind) ? "percentOfPar" : "currency");

export const kindLabelKey = (kind: SecurityKind) => MARKET_MESSAGE_KEYS.kind[kind];

const MATURITY_MONTHS: Record<string, number> = { J: 1, F: 2, M: 3, A: 4, I: 5, U: 6, L: 7, G: 8, S: 9, O: 10, N: 11, D: 12 };

/** Maturity encoded in a BODIVA debt symbol (`XXddMyyX`), at Luanda midnight. */
export function bodivaMaturityDate(symbol: string): EpochMs | undefined {
  const match = /^(\p{L})(\p{L})(\d{2})(\p{L})(\d{2})[\p{L}\p{N}]$/u.exec(symbol.trim().toUpperCase());
  const month = match ? MATURITY_MONTHS[match[4]] : undefined;
  if (!match || month === undefined) return undefined;
  return dayStart(`20${match[5]}-${String(month).padStart(2, "0")}-${match[3]}`, LUANDA);
}

export function isMaturedBond(security: MarketSecurity, now: EpochMs): boolean {
  const maturity = bodivaMaturityDate(security.symbol);
  if (!isBondKind(security.kind) && maturity === undefined) return false;
  return maturity !== undefined && maturity < startOfDay(now);
}

/** The official active universe decides when known; otherwise listed and not matured. */
export const isVisibleOutsideSearch = (security: MarketSecurity, now: EpochMs) =>
  security.officialMarketVisibility ?? (security.isListed !== false && !isMaturedBond(security, now));

export const visibleOutsideSearch = (securities: readonly MarketSecurity[], now: EpochMs) =>
  securities.filter((security) => isVisibleOutsideSearch(security, now));

const differsFromSymbol = (text: string, symbol: string) => text !== "" && text.toLowerCase() !== symbol.toLowerCase();

/** The instrument or issuer name when it says more than the symbol; `undefined` → use `kindLabelKey`. */
export function securityDisplayName(security: MarketSecurity): string | undefined {
  const name = security.name.trim();
  if (differsFromSymbol(name, security.symbol)) return name;
  const issuer = security.issuer.trim();
  if (differsFromSymbol(issuer, security.symbol)) return issuer;
  return undefined;
}

/** The curated logo, else the issuer website's favicon. */
export function resolvedLogoURL(security: MarketSecurity): string | undefined {
  if (security.logoURL) return security.logoURL;
  if (!security.issuerWebsiteURL) return undefined;
  const url = new URL("https://www.google.com/s2/favicons");
  url.searchParams.set("domain_url", security.issuerWebsiteURL);
  url.searchParams.set("sz", "128");
  return url.toString();
}
