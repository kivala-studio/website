import Decimal from "decimal.js";

/**
 * Alert rule kinds (contract §4.3, server enum `notification_rule_kind`; iOS `MarketAlertKind`). iOS shows seven;
 * the web adds `percent_change_below`, which the server accepts.
 */
export const ALERT_KINDS = [
  "price_above",
  "price_below",
  "percent_change_above",
  "percent_change_below",
  "high_52w",
  "low_52w",
  "volume_above_average",
  "days_without_trades",
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const isAlertKind = (value: unknown): value is AlertKind => (ALERT_KINDS as readonly unknown[]).includes(value);

/** 52-week rules carry no user value; the server stores a fixed threshold of 1. */
export const hasThreshold = (kind: AlertKind) => kind !== "high_52w" && kind !== "low_52w";

/** Kinds whose threshold is a price (a percentage of nominal for bonds). */
export const isPriceKind = (kind: AlertKind) => kind === "price_above" || kind === "price_below";

const DEFAULTS: Partial<Record<AlertKind, string>> = { high_52w: "1", low_52w: "1", volume_above_average: "2", days_without_trades: "7" };
export const defaultThreshold = (kind: AlertKind): Decimal | undefined => (DEFAULTS[kind] ? new Decimal(DEFAULTS[kind]) : undefined);

const MAX = new Decimal("1e16");

/** `numeric(24,8)`: non-zero, below 10¹⁶ in size, at most eight decimal places. */
export function isValidThreshold(value: Decimal): boolean {
  return value.isFinite() && !value.isZero() && value.abs().lt(MAX) && value.decimalPlaces() <= 8;
}

/**
 * Mirrors the server check `notification_rules_threshold_by_kind`. A fall is `percent_change_below` with a
 * negative threshold (the change is at or below it); every other kind takes a positive value.
 */
export function acceptsThreshold(kind: AlertKind, value: Decimal): boolean {
  if (!isValidThreshold(value)) return false;
  switch (kind) {
    case "high_52w":
    case "low_52w":
      return value.eq(1);
    case "volume_above_average":
      return value.gte("1.5") && value.lte(20);
    case "days_without_trades":
      return value.isInteger() && value.lte(365);
    case "percent_change_below":
      return value.lt(0);
    default:
      return value.gt(0);
  }
}

export interface AlertRule {
  readonly id: string;
  readonly securityID: string;
  readonly kind: AlertKind;
  readonly threshold: Decimal;
  readonly isEnabled: boolean;
  /** Epoch milliseconds; lists are newest first. */
  readonly createdAt: number;
}

/** A `notification_rules` row (or the route's JSON of one); null when it is not a rule this client knows. */
export function decodeAlertRule(row: unknown): AlertRule | null {
  if (typeof row !== "object" || row === null) return null;
  const value = row as Record<string, unknown>;
  const id = value.id;
  const securityID = value.security_id ?? value.securityID;
  const kind = value.kind;
  const threshold = value.threshold;
  const enabled = value.is_enabled ?? value.isEnabled;
  const created = value.created_at ?? value.createdAt;
  if (typeof id !== "string" || typeof securityID !== "string" || !isAlertKind(kind) || typeof enabled !== "boolean") return null;
  if (typeof threshold !== "string" && typeof threshold !== "number") return null;
  let decimal: Decimal;
  try {
    decimal = new Decimal(threshold);
  } catch {
    return null;
  }
  const createdAt = typeof created === "number" ? created : typeof created === "string" ? Date.parse(created) : NaN;
  return { id, securityID, kind, threshold: decimal, isEnabled: enabled, createdAt: Number.isNaN(createdAt) ? 0 : createdAt };
}

export const newestFirst = (a: AlertRule, b: AlertRule) => b.createdAt - a.createdAt || a.id.localeCompare(b.id);

/** The JSON a route sends for a rule; thresholds stay exact strings. */
export const encodeAlertRule = (rule: AlertRule) => ({
  id: rule.id,
  securityID: rule.securityID,
  kind: rule.kind,
  threshold: rule.threshold.toString(),
  isEnabled: rule.isEnabled,
  createdAt: rule.createdAt,
});

/** Distance of a price threshold from the current price (iOS editor line): within 0.05 % is "equal". */
export function priceDistance(threshold: Decimal, price: Decimal): { direction: "above" | "below" | "equal"; percent: Decimal } | undefined {
  if (price.lte(0)) return undefined;
  const percent = threshold.minus(price).div(price).times(100);
  if (percent.abs().lt("0.05")) return { direction: "equal", percent: new Decimal(0) };
  return { direction: percent.gt(0) ? "above" : "below", percent: percent.abs() };
}

/** The ±% shortcut: price × (1 ± step), two decimals, and the kind it implies. */
export function priceShortcut(price: Decimal, stepPercent: number): { kind: AlertKind; threshold: Decimal } {
  const threshold = price.times(new Decimal(100).plus(stepPercent).div(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return { kind: stepPercent < 0 ? "price_below" : "price_above", threshold };
}

/** Automatic movement sensitivity (`user_movement_preferences.sensitivity`). */
export const MOVEMENT_SENSITIVITIES = ["low", "normal", "high"] as const;
export type MovementSensitivity = (typeof MOVEMENT_SENSITIVITIES)[number];
export const isMovementSensitivity = (value: unknown): value is MovementSensitivity =>
  (MOVEMENT_SENSITIVITIES as readonly unknown[]).includes(value);
