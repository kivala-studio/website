import "server-only";

import { publicEnv } from "@/config/public-env";
import { demoScenario } from "@/data/demo/account";
import { MarketCalendar } from "@/domain/market/calendar";
import { addDays, civilDate } from "@/domain/market/zone";

import { anonymousSupabase } from "../supabase/anonymous-client";
import { unwrap } from "../supabase/read";

export type WrapPeriod = "weekly" | "monthly" | "yearly";
export interface AvailableWrap {
  readonly period: WrapPeriod;
  readonly startsOn: string;
  readonly endsOn: string;
}

const PERIODS: readonly WrapPeriod[] = ["weekly", "monthly", "yearly"];
const CIVIL = /^\d{4}-\d{2}-\d{2}$/;

function decodeWrap(row: unknown): AvailableWrap | undefined {
  if (typeof row !== "object" || row === null) return undefined;
  const { period_type: period, starts_on: startsOn, ends_on: endsOn } = row as Record<string, unknown>;
  if (!PERIODS.includes(period as WrapPeriod) || typeof startsOn !== "string" || typeof endsOn !== "string") return undefined;
  if (!CIVIL.test(startsOn) || !CIVIL.test(endsOn) || endsOn < startsOn) return undefined;
  return { period: period as WrapPeriod, startsOn, endsOn };
}

/**
 * Wrap periods released now (`get_available_market_wraps`, anonymous). The demo `closed` scenario has last
 * week's. A failed read is no recap menu.
 */
export async function readAvailableWraps(now: number): Promise<AvailableWrap[]> {
  try {
    if (publicEnv.dataMode === "demo") {
      if ((await demoScenario()) !== "closed") return [];
      const week = MarketCalendar.week(addDays(now, -7));
      return week ? [{ period: "weekly", startsOn: civilDate(week.start), endsOn: civilDate(addDays(week.start, 4)) }] : [];
    }
    const rows = unwrap(await anonymousSupabase().rpc("get_available_market_wraps")) as unknown[];
    return rows.flatMap((row) => decodeWrap(row) ?? []);
  } catch {
    return [];
  }
}

/** The `/wrap/[period]` slug of a wrap: `semanal-2026-11-02`. */
export const wrapSlug = (wrap: AvailableWrap) => `${{ weekly: "semanal", monthly: "mensal", yearly: "anual" }[wrap.period]}-${wrap.startsOn}`;
