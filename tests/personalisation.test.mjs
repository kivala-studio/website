import test from "node:test";
import assert from "node:assert/strict";
import {
  behavioralInterest,
  interestWeight,
  activityDay,
  validActivity,
} from "../lib/personalisation.ts";
const asset = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const now = Date.parse("2026-10-18T00:00:00+01:00");
const row = (overrides = {}) => ({
  user_id: "owner",
  installation_id: "ios",
  activity_day: "2026-10-18",
  kind: "asset_view",
  security_id: asset,
  related_security_id: null,
  variant: "",
  activity_count: 1,
  ...overrides,
});
test("merges iOS and web before capping daily signals and decays interest over 28 days", () => {
  const result = behavioralInterest(
    [
      row({ activity_count: 2 }),
      row({ installation_id: "web", activity_count: 50 }),
      row({ activity_day: "2026-09-20", activity_count: 2 }),
    ],
    "owner",
    now,
  );
  assert.equal(result[asset], 4);
  assert.equal(
    behavioralInterest(
      [
        row({
          kind: "comparison",
          related_security_id: other,
          activity_count: 3,
        }),
        row({ kind: "search_select", activity_count: 3 }),
      ],
      "owner",
      now,
    )[asset],
    8,
  );
  assert.equal(
    behavioralInterest(
      [row({ kind: "comparison", related_security_id: other })],
      "owner",
      now,
    )[other],
    2,
  );
});
test("ignores other accounts, old/future records and behaviour before the local reset cutoff", () => {
  const rows = [
    row({ user_id: "another" }),
    row({ activity_day: "2026-10-19" }),
    row({ activity_day: "2026-01-01" }),
    row({ activity_count: -1 }),
    row({ kind: "watchlist_remove" }),
  ];
  assert.deepEqual(behavioralInterest(rows, "owner", now), {});
  assert.deepEqual(
    behavioralInterest([row()], "owner", now, now + 86400000),
    {},
  );
});
test("explicit relationships outweigh browsing and events use the native dimensions", () => {
  const profile = {
    held: [asset],
    watched: [asset, other],
    alerts: [other],
    behavior: { [asset]: 7.8, [other]: 8 },
  };
  assert.equal(interestWeight(profile, [asset, other]), 88);
  assert.equal(interestWeight(profile, [other]), 48);
  assert.equal(activityDay(Date.parse("2026-10-17T23:15:00Z")), "2026-10-18");
  assert.equal(
    validActivity({ kind: "comparison", securityID: asset, relatedID: asset }),
    false,
  );
  assert.equal(
    validActivity({ kind: "chart_range", securityID: asset, variant: "1Y" }),
    false,
  );
  assert.equal(
    validActivity({ kind: "chart_range", securityID: asset, variant: "1A" }),
    true,
  );
  assert.equal(validActivity({ kind: "wrap_open" }), true);
});
