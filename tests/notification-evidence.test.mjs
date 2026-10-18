import test from "node:test";
import assert from "node:assert/strict";
import { notificationEvidence } from "../lib/notification-evidence.ts";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = Date.parse("2026-10-18T10:00:00Z");
const fixture = () => ({
  schemaVersion: 1,
  calculationVersion: 1,
  calendarVersion: "verified-calendar",
  baselineDate: "2026-10-15",
  tradingDate: "2026-10-16",
  generatedAt: "2026-10-16T17:00:00Z",
  startValue: "1000",
  endValue: "1100",
  change: "100",
  percentage: "10",
  positions: [
    {
      assetID: id(1),
      symbol: "BAI",
      quantity: "10",
      startPrice: "100",
      endPrice: "110",
      startValue: "1000",
      endValue: "1100",
      contribution: "100",
      percentagePoints: "10",
      startRecordID: id(2),
      endRecordID: id(3),
      startRunID: id(4),
      endRunID: id(5),
      startCollectedAt: "2026-10-15T17:00:00Z",
      endCollectedAt: "2026-10-16T16:00:00Z",
    },
  ],
});
test("accepts coherent frozen figures without needing current holdings or prices", () => {
  const value = fixture();
  assert.deepEqual(notificationEvidence(value, now), value);
  value.positions[0].quantity = "0.333333333333";
  value.positions[0].startValue = value.startValue = "33.3333333333";
  value.positions[0].endValue = value.endValue = "36.66666666663";
  value.positions[0].contribution = value.change = "3.33333333333";
  assert.ok(notificationEvidence(value, now));
});
test("rejects contradictory totals, contributions, duplicate positions and non-finite values", () => {
  for (const mutate of [
    (e) => (e.endValue = "1200"),
    (e) => (e.percentage = "20"),
    (e) => (e.positions[0].contribution = "0"),
    (e) => (e.positions[0].percentagePoints = "30"),
    (e) => e.positions.push({ ...e.positions[0] }),
    (e) => (e.positions[0].quantity = "NaN"),
    (e) => (e.positions[0].startPrice = "-100"),
    (e) => (e.positions = []),
  ]) {
    const e = fixture();
    mutate(e);
    assert.equal(notificationEvidence(e, now), null);
  }
});
test("hides expired, future, malformed or unsupported evidence", () => {
  assert.equal(
    notificationEvidence(fixture(), Date.parse("2026-11-13T17:00:00Z")),
    null,
  );
  for (const mutate of [
    (e) => (e.schemaVersion = 2),
    (e) => (e.calculationVersion = 2),
    (e) => (e.baselineDate = "2026-02-30"),
    (e) => (e.baselineDate = e.tradingDate),
    (e) => (e.generatedAt = "2026-10-20T10:00:00Z"),
    (e) => (e.positions[0].endCollectedAt = "2026-10-18T10:00:00Z"),
    (e) => (e.positions[0].startRecordID = null),
  ]) {
    const e = fixture();
    mutate(e);
    assert.equal(notificationEvidence(e, now), null);
  }
  for (const e of [null, {}, { positions: [null] }, "bad"])
    assert.equal(notificationEvidence(e, now), null);
});
