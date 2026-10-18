import test from "node:test";
import assert from "node:assert/strict";
import { wrapRows } from "../lib/wrap-evidence.ts";
const now = Date.parse("2026-10-18T12:00:00Z");
const period = {
  period_type: "weekly",
  starts_on: "2026-10-12",
  ends_on: "2026-10-18",
  available_at: "2026-10-17T00:00:00Z",
  expires_at: "2026-10-19T00:00:00Z",
};
const security = {
  id: "asset",
  symbol: "BAI",
  security_type: "equity",
  currency: "AOA",
  is_active: true,
};
function evidence() {
  const calendar = Array.from({ length: 21 }, (_, i) => {
    const day = new Date(Date.parse("2026-09-28") + i * 86400000);
    const open = day.getUTCDay() > 0 && day.getUTCDay() < 6;
    return {
      day: day.toISOString().slice(0, 10),
      is_open: open,
      opens_at: open ? "09:00:00" : null,
      closes_at: open ? "15:00:00" : null,
    };
  });
  return {
    contract_version: 3,
    fetched_at: new Date(now).toISOString(),
    baseline_day: "2026-10-09",
    calendar,
    calendar_snapshot: {
      contract_version: 2,
      timezone: "Africa/Luanda",
      source: "https://www.bodiva.ao/calendar",
      fetched_at: new Date(now).toISOString(),
      valid_until: new Date(now + 120000).toISOString(),
      starts_on: "2026-09-28",
      ends_on: "2026-10-18",
      days: calendar.map((d) => ({
        ...d,
        kind: d.is_open ? "regular" : "non_trading",
      })),
    },
    observations: ["2026-10-09", "2026-10-16"].map((day, i) => ({
      record_id: `row-${i}`,
      asset_id: "asset",
      currency_code: "AOA",
      dataset: "price_history.equities",
      price: i ? "110" : "100",
      observed_at: `${day}T14:00:00Z`,
      collected_at: `${day}T15:30:00Z`,
      is_final: true,
      source_sha256: "a".repeat(64),
      parser_version: "v1",
      data_quality: {
        status: "valid",
        reasons: [],
        validUntilEpoch: now / 1000 + 120,
      },
    })),
  };
}
test("wrap comparisons require complete matching verified calendars", () => {
  const data = evidence();
  assert.ok(
    Math.abs(wrapRows(data, period, [security], now)[0].change - 10) < 1e-8,
  );
  data.calendar_snapshot.days[4].opens_at = null;
  assert.equal(wrapRows(data, period, [security], now), null);
});
test("expired windows and calendar evidence cannot remain a live recap", () => {
  assert.equal(wrapRows(evidence(), period, [security], now + 121000), null);
  assert.equal(
    wrapRows(
      evidence(),
      { ...period, expires_at: new Date(now).toISOString() },
      [security],
      now,
    ),
    null,
  );
});
test("missing provenance, mismatched currency and duplicate observations cannot form a pair", () => {
  const data = evidence();
  data.observations[0].currency_code = "USD";
  assert.deepEqual(wrapRows(data, period, [security], now), []);
  data.observations[0].currency_code = "AOA";
  data.observations[0].source_sha256 = "invalid";
  assert.deepEqual(wrapRows(data, period, [security], now), []);
  const duplicate = evidence();
  duplicate.observations.push(duplicate.observations[0]);
  assert.equal(wrapRows(duplicate, period, [security], now), null);
});
