import Decimal from "decimal.js";

type Position = {
  assetID: string;
  symbol: string;
  quantity: string;
  startPrice: string;
  endPrice: string;
  startValue: string;
  endValue: string;
  contribution: string;
  percentagePoints: string;
  startRecordID: string;
  endRecordID: string;
  startRunID: string;
  endRunID: string;
  startCollectedAt: string;
  endCollectedAt: string;
};
export type NotificationEvidence = {
  schemaVersion: number;
  calculationVersion: number;
  calendarVersion: string;
  baselineDate: string;
  tradingDate: string;
  startValue: string;
  endValue: string;
  change: string;
  percentage: string;
  generatedAt: string;
  positions: Position[];
};
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const day = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const instant = (value: unknown): value is string =>
  typeof value === "string" &&
  /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));
function decimal(value: unknown) {
  if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value))
    throw new Error("Invalid amount");
  const result = new Decimal(value);
  if (!result.isFinite() || result.abs().gt("1e30"))
    throw new Error("Invalid amount");
  return result;
}
// PostgreSQL numeric divisions and Decimal can differ below display precision.
const equal = (a: Decimal, b: Decimal) =>
  a
    .minus(b)
    .abs()
    .lte(Decimal.max(a.abs(), b.abs(), 1).mul("1e-12"));

/** Frozen server evidence, never recomputed against today's holdings or quotes. */
export function notificationEvidence(
  input: unknown,
  now = Date.now(),
): NotificationEvidence | null {
  try {
    if (!input || typeof input !== "object") return null;
    const e = input as NotificationEvidence;
    if (
      e.schemaVersion !== 1 ||
      e.calculationVersion !== 1 ||
      typeof e.calendarVersion !== "string" ||
      !e.calendarVersion ||
      !day(e.baselineDate) ||
      !day(e.tradingDate) ||
      e.baselineDate >= e.tradingDate ||
      !instant(e.generatedAt) ||
      Date.parse(e.generatedAt) > now ||
      Date.parse(e.generatedAt) + 28 * 86400000 <= now ||
      Date.parse(`${e.tradingDate}T00:00:00+01:00`) >
        Date.parse(e.generatedAt) ||
      !Array.isArray(e.positions) ||
      !e.positions.length
    )
      return null;
    const start = decimal(e.startValue),
      end = decimal(e.endValue),
      change = decimal(e.change);
    if (
      !start.gt(0) ||
      !end.gt(0) ||
      !equal(end.minus(start), change) ||
      !equal(change.div(start).mul(100), decimal(e.percentage))
    )
      return null;
    let sumStart = new Decimal(0),
      sumEnd = new Decimal(0);
    const ids = new Set<string>();
    for (const p of e.positions) {
      if (
        !p ||
        !uuid(p.assetID) ||
        ids.has(p.assetID) ||
        typeof p.symbol !== "string" ||
        !p.symbol ||
        !uuid(p.startRecordID) ||
        !uuid(p.endRecordID) ||
        p.startRecordID === p.endRecordID ||
        !uuid(p.startRunID) ||
        !uuid(p.endRunID) ||
        !instant(p.startCollectedAt) ||
        !instant(p.endCollectedAt) ||
        Date.parse(p.startCollectedAt) > Date.parse(e.generatedAt) ||
        Date.parse(p.endCollectedAt) > Date.parse(e.generatedAt)
      )
        return null;
      ids.add(p.assetID);
      const quantity = decimal(p.quantity),
        first = decimal(p.startPrice),
        last = decimal(p.endPrice);
      const firstValue = decimal(p.startValue),
        lastValue = decimal(p.endValue),
        contribution = decimal(p.contribution);
      if (
        !quantity.gt(0) ||
        !first.gt(0) ||
        !last.gt(0) ||
        !equal(quantity.mul(first), firstValue) ||
        !equal(quantity.mul(last), lastValue) ||
        !equal(lastValue.minus(firstValue), contribution) ||
        !equal(contribution.div(start).mul(100), decimal(p.percentagePoints))
      )
        return null;
      sumStart = sumStart.plus(firstValue);
      sumEnd = sumEnd.plus(lastValue);
    }
    if (!equal(sumStart, start) || !equal(sumEnd, end)) return null;
    return e;
  } catch {
    return null;
  }
}
