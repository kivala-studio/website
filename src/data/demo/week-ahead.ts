import "server-only";

import { type DemoScenario, demoSnapshot } from "@/data/market/demo/scenarios";
import { type EpochMs, DAY_MS, civilDate } from "@/domain/market/zone";
import { nextWeek } from "@/domain/week-ahead/week-ahead";

type Row = Record<string, unknown>;

const BAI = { id: "7398e912-aaf8-430f-aaae-883931c9cd84", name: "Banco Angolano de Investimentos" };
const BFA = { id: "5a85c93c-4801-4359-ab16-e976d515a9f6", name: "Banco de Fomento Angola" };
const SBA = { id: "dc9bfb31-404c-4b7e-afbc-d21dd21abbf9", name: "Standard Bank de Angola" };

/**
 * Demo `issuer_dividends` for the coming week, as PostgREST returns them with `issuers(id,name)`: BAI (held in the
 * demo ledger) has its ex-dividend and record dates, BFA (on the default list, not held) pays, Standard Bank (market, and an
 * issuer with a bond that must stay unrelated) pays on Friday. The `empty` scenario has none.
 */
export function demoWeekDividendRows(scenario: DemoScenario, now: EpochMs): Row[] {
  const week = nextWeek(now);
  if (!week || scenario === "empty") return [];
  const day = (offset: number) => civilDate(week.interval.start + offset * DAY_MS);
  const updated = new Date(now - 2 * 3_600_000).toISOString();
  const row = (id: string, issuer: { id: string; name: string }, dates: Partial<Record<"record_date" | "ex_dividend_date" | "payment_date", string>>) => ({
    id,
    issuer_id: issuer.id,
    fiscal_year: 2025,
    record_date: null,
    ex_dividend_date: null,
    payment_date: null,
    ...dates,
    source_url: "https://www.bodiva.ao/",
    updated_at: updated,
    issuers: issuer,
  });
  return [
    row("6f1d2c3a-1b2c-4d3e-8f40-0a1b2c3d4e01", BAI, { ex_dividend_date: day(0), record_date: day(2) }),
    row("6f1d2c3a-1b2c-4d3e-8f40-0a1b2c3d4e02", BFA, { payment_date: day(3) }),
    row("6f1d2c3a-1b2c-4d3e-8f40-0a1b2c3d4e03", SBA, { payment_date: day(4) }),
  ];
}

/** The re-dated snapshot's calendar document; `unverified` has none for the coming week, `empty` keeps the verified one. */
export function demoWeekCalendar(scenario: DemoScenario, now: EpochMs, regularWeek = false): Row | null {
  return scenario === "unverified" ? null : (demoSnapshot(scenario === "empty" ? "open" : scenario, now, regularWeek).calendar as Row);
}
