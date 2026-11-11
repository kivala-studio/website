import Decimal from "decimal.js";

import type { PricePoint } from "./models";
import { type EpochMs, addDays, startOfDay, weekday } from "./zone";

/**
 * iOS `LiquidityProfile`: trading activity over the last market sessions. Daily history only holds
 * sessions with trades, so frequency is measured against the market's own session calendar.
 */
export interface LiquidityProfile {
  readonly sessions: number;
  readonly tradedSessions: number;
  /** Kwanzas per session, counting sessions without trades as zero. */
  readonly averageDailyValue: Decimal;
  readonly averageDailyVolume: Decimal;
  /** Sessions needed to sell `heldQuantity` at the average daily volume. */
  readonly sessionsToExit?: number;
}

export const LIQUIDITY_WINDOW = 20;

const ZERO = new Decimal(0);

export function liquidityProfile(input: {
  history: readonly PricePoint[];
  /** Any instant inside each session day of the market calendar. */
  sessionDates: readonly EpochMs[];
  /** 0.01 for bonds quoted as a percentage of par, 1 otherwise. */
  priceScale: Decimal;
  heldQuantity: Decimal;
  now: EpochMs;
}): LiquidityProfile | undefined {
  const { history, sessionDates, priceScale, heldQuantity, now } = input;
  const today = startOfDay(now);
  let sessions = [...new Set(sessionDates.map((date) => startOfDay(date)).filter((day) => day <= today))]
    .sort((a, b) => b - a)
    .slice(0, LIQUIDITY_WINDOW);
  if (sessions.length < LIQUIDITY_WINDOW) {
    // Without the market calendar, assume weekday sessions.
    sessions = Array.from({ length: 60 }, (_, offset) => addDays(today, -offset))
      .filter((day) => weekday(day) !== 1 && weekday(day) !== 7)
      .slice(0, LIQUIDITY_WINDOW);
  }
  const oldest = sessions.at(-1);
  if (oldest === undefined) return undefined;

  const traded = history.filter(
    (point) => point.volume !== undefined && point.volume.gt(0) && startOfDay(point.date) >= oldest && point.date <= now,
  );
  const volume = traded.reduce((total, point) => total.plus(point.volume ?? ZERO), ZERO);
  const value = traded.reduce((total, point) => total.plus((point.volume ?? ZERO).times(point.value).times(priceScale)), ZERO);
  const count = sessions.length;
  const averageDailyVolume = volume.div(count);
  const sessionsToExit =
    heldQuantity.gt(0) && averageDailyVolume.gt(0) ? Number(heldQuantity.div(averageDailyVolume).ceil().toFixed(0)) : undefined;
  return {
    sessions: count,
    tradedSessions: new Set(traded.map((point) => startOfDay(point.date))).size,
    averageDailyValue: value.div(count),
    averageDailyVolume,
    sessionsToExit,
  };
}
