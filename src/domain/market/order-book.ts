import Decimal from "decimal.js";

import { FREE_PLAN_LIMITS } from "../account/access";
import { readDataQuality } from "./decode";
import { MarketDecodingError } from "./decoding-error";
import { jsonGuards } from "./json-guards";
import type { OrderBookLevel } from "./models";
import type { DataQualityReport } from "./quality";

/*
 * iOS `MarketOrderBookLevel`, `OrderBookRow` and `AssetOrderBookSection` (contract §3.7). Whether a
 * book may be shown as current is `availableOrderBook` (quote-policy.ts): only while the market is
 * open, inside the session context and with current book evidence.
 */

/** `quality_latest_order_books` row. */
export interface OrderBookRow {
  readonly securityID: string;
  readonly tradingDate?: string;
  readonly levels: readonly OrderBookLevel[];
  readonly dataQuality?: DataQualityReport;
}

const json = jsonGuards("market.orderBook");

const readSide = (value: unknown, path: string): OrderBookLevel["side"] =>
  value === "bid" || value === "ask" ? value : json.fail(path, "bid or ask");

const readLevel = (value: unknown, path: string): OrderBookLevel => {
  const row = json.object(value, path);
  return {
    side: json.required(row, "side", readSide, path),
    level: json.required(row, "level", json.integer, path),
    price: json.required(row, "price", json.decimal, path),
    quantity: json.required(row, "quantity", json.decimal, path),
    orderCount: json.optional(row, "order_count", json.integer, path),
  };
};

const readRow = (value: unknown, path: string): OrderBookRow => {
  const row = json.object(value, path);
  return {
    securityID: json.required(row, "security_id", json.string, path),
    tradingDate: json.optional(row, "trading_date", json.string, path),
    levels: json.required(row, "order_book_levels", json.array(readLevel), path),
    dataQuality: json.optional(row, "data_quality", readDataQuality, path),
  };
};

/** Parsed JSON rows in, typed rows out; `MarketDecodingError` on a broken contract. */
export const decodeOrderBookRows = (body: unknown) => json.array(readRow)(body, "$");

/**
 * The book and its evidence from the latest-book query (newest first, limit 2). More than one row
 * breaks the contract; priced levels with a non-negative quantity are kept, ordered by level.
 */
export function orderBookFromRows(rows: readonly OrderBookRow[]): { orderBook?: OrderBookLevel[]; orderBookQuality?: DataQualityReport } {
  if (rows.length > 1) throw new MarketDecodingError("market.orderBook", "more than one latest book");
  const row = rows[0];
  if (!row) return {};
  return {
    orderBookQuality: row.dataQuality,
    orderBook: row.levels
      .filter((level) => level.price.isFinite() && level.price.gt(0) && level.quantity.isFinite() && level.quantity.gte(0))
      .sort((a, b) => a.level - b.level),
  };
}

/** Older snapshots stored missing counts as zero, so only a positive count is known. */
export const availableOrderCount = (level: OrderBookLevel) =>
  level.orderCount !== undefined && level.orderCount > 0 ? level.orderCount : undefined;

/** Levels per side a Free account sees; undefined shows the full book. */
export const orderBookDepthLimit = (unlocksPro: boolean): number | undefined =>
  unlocksPro ? undefined : FREE_PLAN_LIMITS.orderBookLevels;

/** One row of the book: the bid and ask at the same rank. */
export interface OrderBookPair {
  readonly rank: number;
  readonly bid?: OrderBookLevel;
  readonly ask?: OrderBookLevel;
}

export interface OrderBookLayout {
  readonly pairs: readonly OrderBookPair[];
  readonly bidCount: number;
  readonly askCount: number;
  /** Levels on the deeper side. */
  readonly depth: number;
  /** `depth > pairs.length`: offer `orderBook.unlockDepth` with `depth`. */
  readonly isTruncated: boolean;
  /** Best ask minus best bid, when both sides exist. */
  readonly spread?: Decimal;
  /** The largest shown quantity: one scale for both sides' depth bars. */
  readonly maximumQuantity: Decimal;
  /** Adds `assetDetails.orderBook.countsNote`. */
  readonly hasUnknownCounts: boolean;
}

const ZERO = new Decimal(0);
const ONE = new Decimal(1);

/** Pairs bids and asks by rank, best first, up to `depthLimit` per side. */
export function orderBookLayout(levels: readonly OrderBookLevel[], depthLimit?: number): OrderBookLayout {
  const side = (name: OrderBookLevel["side"]) => levels.filter((level) => level.side === name).sort((a, b) => a.level - b.level);
  const bids = side("bid");
  const asks = side("ask");
  const depth = Math.max(bids.length, asks.length);
  const shown = Math.min(depth, depthLimit ?? depth);
  const quantities = [...bids.slice(0, shown), ...asks.slice(0, shown)].map((level) => level.quantity);
  return {
    pairs: Array.from({ length: shown }, (_, index) => ({ rank: index + 1, bid: bids[index], ask: asks[index] })),
    bidCount: bids.length,
    askCount: asks.length,
    depth,
    isTruncated: shown < depth,
    spread: bids[0] && asks[0] ? asks[0].price.minus(bids[0].price) : undefined,
    maximumQuantity: quantities.length ? Decimal.max(...quantities) : ZERO,
    hasUnknownCounts: levels.some((level) => availableOrderCount(level) === undefined),
  };
}

/** A depth bar's width as a share of the row, in [0, 1]; zero when there is no scale. */
export function depthBarScale(level: OrderBookLevel, maximumQuantity: Decimal): Decimal {
  if (!maximumQuantity.gt(0)) return ZERO;
  return Decimal.min(Decimal.max(level.quantity.div(maximumQuantity), ZERO), ONE);
}
