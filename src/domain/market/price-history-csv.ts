import type Decimal from "decimal.js";

import { formatNumber } from "../format/number";
import type { PricePoint } from "./models";
import { civilDate } from "./zone";

/*
 * iOS `PriceHistoryCSV`: daily closes, oldest first, as semicolon-separated rows with CRLF line
 * ends, Luanda civil dates and pt_PT decimal commas without grouping (up to 8 decimals), matching
 * the portfolio export byte for byte.
 */

export const PRICE_HISTORY_CSV_HEADER = ["data", "fecho", "abertura", "maximo", "minimo", "volume", "negocios"] as const;

const cell = (value: Decimal | undefined) =>
  value === undefined || !value.isFinite() ? "" : formatNumber(value, "pt", { minFraction: 0, maxFraction: 8, grouping: false });

export function exportPriceHistoryCSV(points: readonly PricePoint[]): string {
  const rows = [...points]
    .sort((a, b) => a.date - b.date)
    .map((point) => [
      civilDate(point.date),
      cell(point.value),
      cell(point.openValue),
      cell(point.highValue),
      cell(point.lowValue),
      cell(point.volume),
      point.tradeCount === undefined ? "" : String(point.tradeCount),
    ]);
  return `${[PRICE_HISTORY_CSV_HEADER, ...rows].map((row) => row.join(";")).join("\r\n")}\r\n`;
}

/** `invest-ao-bfaaaaaa-historico.csv`. */
export const priceHistoryCSVFileName = (symbol: string) => `invest-ao-${symbol.toLowerCase()}-historico.csv`;

/** Offered from two points on (iOS shows the export entry only then). */
export const canExportPriceHistory = (points: readonly PricePoint[]) => points.length >= 2;
