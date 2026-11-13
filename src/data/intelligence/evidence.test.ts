import { describe, expect, it, vi } from "vitest";

import { InsightEngine } from "@/domain/intelligence/engine";
import { decodeCalendarResponse, decodeMarketCalendar } from "@/domain/market";

vi.mock("server-only", () => ({}));
const { demoMarketPeriodEvidence } = await import("@/data/demo/intelligence-evidence");
const { demoSnapshot } = await import("@/data/market/demo/scenarios");
const { EvidenceError, decodeMarketPeriodEvidence, evidenceParameters } = await import("./evidence");

const BAI = "3c55bf40-8544-4598-bf76-15a165dbeff3";
const BCG = "ec7084ad-90ac-4cd2-b481-1572d02e2488";
const BDV = "51399e7d-8108-434a-b852-c6646a3e9579";
const BFA = "9e49d0ca-2200-47ee-969e-3502a0d23b7c";
/** Saturday morning in Luanda. */
const now = Date.parse("2026-11-14T09:00:00Z");

function completedWeek() {
  const calendar = decodeMarketCalendar(decodeCalendarResponse(demoSnapshot("open", now).calendar), now);
  return calendar.previousCompletedTradingWeek(now)!.period;
}

function response() {
  const period = completedWeek();
  const { starts_on, ends_on } = evidenceParameters(period);
  return { period, json: demoMarketPeriodEvidence("open", starts_on, ends_on, now) as Record<string, unknown> };
}

type Rows = Record<string, unknown>[];

describe("market period evidence", () => {
  it("decodes the demo response into evidence the engine verifies", () => {
    const { period, json } = response();
    const evidence = decodeMarketPeriodEvidence(json, period, now);
    expect(evidence.comparisonPeriod.endExclusive).toBe(period.endExclusive);
    expect(evidence.comparisonPeriod.start).toBeLessThan(period.start);
    const insights = new InsightEngine().evaluate({
      period: evidence.comparisonPeriod,
      generatedAt: now,
      fetchedAt: evidence.fetchedAt,
      calendar: evidence.calendar,
      observations: evidence.observations,
      watchlistIDs: new Set([BAI, BCG, BDV, BFA]),
      portfolioIDs: new Set(),
      activityAssetIDs: [],
    });
    const types = new Set(insights.map((insight) => insight.type));
    expect(types.has("assetPriceChange")).toBe(true);
    expect(types.has("watchlistBreadth")).toBe(true);
    const breadth = insights.find((insight) => insight.type === "watchlistBreadth")!;
    expect(breadth.fact.kind === "breadth" && breadth.fact.value.assetCount).toBe(4);
  });

  it("keeps only final rows", () => {
    const { period, json } = response();
    const rows = json.observations as Rows;
    const tampered = { ...json, observations: rows.map((row, index) => (index === 0 ? { ...row, is_final: false } : row)) };
    const evidence = decodeMarketPeriodEvidence(tampered, period, now);
    expect(evidence.observations).toHaveLength(rows.length - 1);
    expect(evidence.observations.every((row) => row.isFinal)).toBe(true);
  });

  it("requires contract v3 with a calendar snapshot for a live response", () => {
    const { period, json } = response();
    expect(() => decodeMarketPeriodEvidence({ ...json, contract_version: 2 }, period, now)).toThrow(EvidenceError);
    expect(() => decodeMarketPeriodEvidence({ ...json, calendar_snapshot: null }, period, now)).toThrow("wrap.calendarContract");
  });

  it("reports missing history separately from malformed evidence", () => {
    const { period, json } = response();
    expect(() => decodeMarketPeriodEvidence({ ...json, baseline_day: null }, period, now)).toThrow("insufficientHistory");
  });

  it("rejects malformed provenance, a missing quality report and a day list that contradicts the snapshot", () => {
    const { period, json } = response();
    const rows = json.observations as Rows;
    const replace = (row: Record<string, unknown>) => ({ ...json, observations: [row, ...rows.slice(1)] });
    expect(() => decodeMarketPeriodEvidence(replace({ ...rows[0], source_sha256: "abc" }), period, now)).toThrow("wrap.observation");
    expect(() => decodeMarketPeriodEvidence(replace({ ...rows[0], dataset: "chart" }), period, now)).toThrow("wrap.observation");
    expect(() => decodeMarketPeriodEvidence(replace({ ...rows[0], data_quality: null }), period, now)).toThrow("wrap.qualityContract");
    const days = json.calendar as Rows;
    const lastOpen = days.findLastIndex((day) => day.is_open === true);
    const shifted = days.map((day, index) => (index === lastOpen ? { ...day, closes_at: "14:00:00" } : day));
    expect(() => decodeMarketPeriodEvidence({ ...json, calendar: shifted }, period, now)).toThrow("wrap.calendarMismatch");
  });
});
