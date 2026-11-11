import type { Format, Translate } from "../format";
import { isBondKind } from "./classification";
import type { MarketSecurity, SecurityKind } from "./models";
import { canExportPriceHistory } from "./price-history-csv";
import { displayPercentageChange, displayPrice, displayPriceLabel } from "./quote-policy";
import { type TimeRange, availableRanges } from "./time-range";
import type { EpochMs } from "./zone";

/*
 * Pure parts of iOS `AssetDetailsView` and `AssetChartSection`. The range, movement and
 * performance maths its tests cover (`AssetDetailsLogicTests`) live in time-range.ts.
 */

/** Share sheet subject and text: symbol, displayed price, BODIVA variation and price source. */
export function assetShareContent(
  security: MarketSecurity,
  now: EpochMs,
  format: Format,
  translate: Translate,
): { subject: string; text: string } {
  const subject = translate("assetDetails.share.subject", { arg1: security.symbol });
  const price = displayPrice(security, now);
  if (price === undefined) {
    return { subject, text: translate("assetDetails.share.textWithPrice", { arg1: security.symbol, arg2: security.name }) };
  }
  const change = displayPercentageChange(security, now);
  const label = displayPriceLabel(security, now);
  return {
    subject,
    text: translate("assetDetails.share.textWithChange", {
      arg1: security.symbol,
      arg2: format.securityPrice(price, { bond: isBondKind(security.kind), code: security.currency ?? "AOA" }),
      arg3: change === undefined ? "" : `, ${format.percent(change)}`,
      arg4: label === undefined ? "" : ` · ${translate(label)}`,
    }),
  };
}

/** `hidden` below two points; Free accounts see the entry and are asked to upgrade (`priceExport`). */
export function historyExportAccess(security: MarketSecurity, unlocksPlus: boolean): "hidden" | "locked" | "available" {
  if (!canExportPriceHistory(security.history)) return "hidden";
  return unlocksPlus ? "available" : "locked";
}

/** The detail chart always lists `1D`; it is enabled only on a trading day. */
export const detailChartRanges = (security: MarketSecurity): TimeRange[] => [
  "1D",
  ...availableRanges(security.history).filter((range) => range !== "1D"),
];

export const isDetailRangeEnabled = (range: TimeRange, isTodayTradingDay: boolean | undefined) =>
  range !== "1D" || isTodayTradingDay === true;

/** Falls back to `1S` when the selection is no longer offered or `1D` is not a trading day. */
export function validatedDetailRange(selected: TimeRange, security: MarketSecurity, isTodayTradingDay: boolean | undefined): TimeRange {
  if (!detailChartRanges(security).includes(selected) || (selected === "1D" && isTodayTradingDay === false)) return "1S";
  return selected;
}

/** Kinds with an issuer section (profile, reports, dividend). */
export const supportsIssuerInformation = (kind: SecurityKind) => kind === "corporateBond" || kind === "equity" || kind === "fund";
