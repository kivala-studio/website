import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type MarketIndex,
  type SecurityKind,
  type SecurityRow,
  type VerifiedClosingPrice,
  classifySecurityKind,
  decodePulseRows,
  decodeSecurityRows,
  decodeVerifiedCloseRows,
  makeMarketIndex,
  verifiedClosingPrice,
} from "@/domain/market";
import { type EpochMs, DAY_MS } from "@/domain/market/zone";

import { readAll, unwrap } from "../supabase/read";
import { readPriceHistoryRows } from "./history";

/*
 * Reads for server-rendered public pages. Their results are cached and shared between visitors,
 * so they never include a current price: only the catalogue and dated, verified evidence. The
 * current quote is added in the browser by the market store after its own validity check.
 */

/** An instrument as public pages may render it before any current quote. */
export interface PublicInstrument {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly isin?: string;
  readonly currency?: string;
  readonly kind: SecurityKind;
  readonly issuerID?: string;
  readonly isListed?: boolean;
  /** The last verified close with its session date: display evidence, never a live price. */
  readonly closingPrice?: VerifiedClosingPrice;
}

/** Signed-out visitors see at most one year of daily history. */
export const PUBLIC_HISTORY_DAYS = 365;

export function publicInstrument(row: SecurityRow, closingPrice: VerifiedClosingPrice | undefined): PublicInstrument {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name ?? row.symbol,
    isin: row.isin,
    currency: row.currency,
    kind: classifySecurityKind({ type: row.securityType, name: row.name, symbol: row.symbol }),
    issuerID: row.issuerID,
    isListed: row.isActive,
    closingPrice,
  };
}

/*
 * Reads return raw JSON rows so they can be cached (`unstable_cache` serialises results, which
 * would turn `Decimal` into strings); decoding happens per request, against that request's clock.
 */

export type CatalogueRows = { securities: unknown[]; closes: unknown[] };

/** Catalogue and verified close rows (M4 + M5): no quote, session or snapshot read. */
export async function readCatalogueRows(client: SupabaseClient): Promise<CatalogueRows> {
  const [securities, closes] = await Promise.all([
    readAll((from, to) =>
      client.from("securities").select("id,symbol,isin,name,currency,security_type,issuer_id,is_active").order("symbol").order("id").range(from, to),
    ),
    readAll((from, to) => client.from("latest_verified_market_closes").select().order("security_id").range(from, to)),
  ]);
  return { securities, closes };
}

/** The catalogue with each instrument's verified close, assessed at `now`. */
export function publicCatalogue(rows: CatalogueRows, now: EpochMs): PublicInstrument[] {
  const closeRows = decodeVerifiedCloseRows(rows.closes);
  const counts = new Map<string, number>();
  for (const row of closeRows) counts.set(row.securityID, (counts.get(row.securityID) ?? 0) + 1);
  const closeByID = new Map(closeRows.filter((row) => counts.get(row.securityID) === 1).map((row) => [row.securityID, row]));
  return decodeSecurityRows(rows.securities)
    .map((row) => {
      const close = closeByID.get(row.id);
      return publicInstrument(row, close && verifiedClosingPrice(close, now));
    })
    .sort((a, b) => (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));
}

/** One year of daily rows for the public chart, up to today (Luanda); decode with `pricePoints`. */
export function readPublicHistoryRows(client: SupabaseClient, securityID: string, now: EpochMs): Promise<unknown[]> {
  return readPriceHistoryRows(client, securityID, { from: now - PUBLIC_HISTORY_DAYS * DAY_MS, through: now });
}

/** The invest.ao indicator series from raw pulse rows (verified daily values only). */
export const publicPulse = (rows: unknown): MarketIndex => makeMarketIndex(decodePulseRows(rows));

export interface PublicIssuer {
  readonly id: string;
  readonly name: string;
  readonly shortName?: string;
  readonly logoURL?: string;
  readonly websiteURL?: string;
  readonly sector?: string;
  readonly headquarters?: string;
  readonly description?: string;
}

export interface PublicDividend {
  readonly issuerID: string;
  readonly amountPerShare?: string;
  readonly currency?: string;
  readonly exDividendDate?: string;
  readonly paymentDate?: string;
  readonly frequency?: string;
}

export interface PublicFinancialReport {
  readonly id: string;
  readonly title: string;
  readonly reportingPeriod?: string;
  readonly publishedAt?: string;
  readonly url: string;
}

type Row = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);
const https = (value: unknown) => {
  const raw = text(value);
  try {
    return raw && new URL(raw).protocol === "https:" ? raw : undefined;
  } catch {
    return undefined;
  }
};

/** M17: an active issuer. */
export async function readPublicIssuer(client: SupabaseClient, issuerID: string): Promise<PublicIssuer | undefined> {
  const rows = unwrap(await client.from("issuers").select().eq("id", issuerID).eq("is_active", true).limit(1)) as Row[];
  const row = rows[0];
  if (!row || !text(row.id) || !text(row.name)) return undefined;
  return {
    id: String(row.id),
    name: String(row.name),
    shortName: text(row.short_name),
    logoURL: https(row.logo_url),
    websiteURL: https(row.website_url),
    sector: text(row.sector),
    headquarters: text(row.headquarters),
    description: text(row.description),
  };
}

/** M19: the latest declared dividend; the amount stays exact text. */
export async function readPublicDividend(client: SupabaseClient, issuerID: string): Promise<PublicDividend | undefined> {
  const rows = unwrap(
    await client.from("latest_issuer_dividends").select().eq("issuer_id", issuerID).order("fiscal_year", { ascending: false }).limit(1),
  ) as Row[];
  const row = rows[0];
  if (!row) return undefined;
  const amount = row.amount_per_share;
  return {
    issuerID,
    amountPerShare: typeof amount === "number" || typeof amount === "string" ? String(amount) : undefined,
    currency: text(row.currency),
    exDividendDate: text(row.ex_dividend_date),
    paymentDate: text(row.payment_date),
    frequency: text(row.frequency),
  };
}

/** M18: financial reports with an `https` document only. */
export async function readPublicReports(client: SupabaseClient, issuerID: string): Promise<PublicFinancialReport[]> {
  const rows = (await readAll((from, to) =>
    client.from("issuer_financial_reports").select().eq("issuer_id", issuerID).order("period_end", { ascending: false }).order("id").range(from, to),
  )) as Row[];
  return rows.flatMap((row) => {
    const url = https(row.url);
    const id = text(row.id);
    const title = text(row.title);
    return url && id && title ? [{ id, title, url, reportingPeriod: text(row.reporting_period), publishedAt: text(row.published_at) }] : [];
  });
}

/** News list select (W1 of ios-platform §3.7). */
export const NEWS_SUMMARY_SELECT =
  "id,slug,title,summary,published_at,recap_period,market_recaps(trading_date),news_article_categories(news_categories(name)),news_article_sources(source_url,source_title,is_primary,news_sources(name)),news_article_securities(securities(id,symbol,name))";

/** Published articles, newest first; one extra row tells whether another page exists. */
export async function readPublicNews(
  client: SupabaseClient,
  { offset = 0, limit = 20, now }: { offset?: number; limit?: number; now: EpochMs },
): Promise<{ articles: Row[]; hasMore: boolean }> {
  const rows = unwrap(
    await client
      .from("news_articles")
      .select(NEWS_SUMMARY_SELECT)
      .eq("status", "published")
      .lte("published_at", new Date(now).toISOString())
      .order("published_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit),
  ) as Row[];
  return { articles: rows.slice(0, limit), hasMore: rows.length > limit };
}

/** One published article with its Markdown body, by slug. */
export async function readPublicArticle(client: SupabaseClient, slug: string, now: EpochMs): Promise<Row | undefined> {
  const rows = unwrap(
    await client
      .from("news_articles")
      .select(`body_markdown,${NEWS_SUMMARY_SELECT}`)
      .eq("status", "published")
      .lte("published_at", new Date(now).toISOString())
      .eq("slug", slug)
      .limit(1),
  ) as Row[];
  return rows[0];
}
