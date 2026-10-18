import { createEdition } from "../../app/resumos/edition.ts";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const user = id(1),
  asset = id(2);
const now = Date.parse("2026-10-18T12:00:00Z");
const period = {
  period_type: "weekly",
  starts_on: "2026-10-12",
  ends_on: "2026-10-18",
  available_at: "2026-10-17T00:00:00Z",
  expires_at: "2026-10-19T00:00:00Z",
};
const securities = [
  {
    id: asset,
    symbol: "BAI",
    name: "BAI",
    currency: "AOA",
    security_type: "equity",
    is_active: true,
    issuer_id: id(3),
    isin: null,
  },
];
function evidence(at = now) {
  const calendar = Array.from({ length: 21 }, (_, i) => {
    const value = new Date(Date.parse("2026-09-28") + i * 86400000);
    const open = value.getUTCDay() > 0 && value.getUTCDay() < 6;
    return {
      day: value.toISOString().slice(0, 10),
      is_open: open,
      opens_at: open ? "09:00:00" : null,
      closes_at: open ? "15:00:00" : null,
    };
  });
  return {
    contract_version: 3,
    fetched_at: new Date(at).toISOString(),
    baseline_day: "2026-10-09",
    calendar,
    calendar_snapshot: {
      contract_version: 2,
      timezone: "Africa/Luanda",
      source: "https://www.bodiva.ao/calendar",
      fetched_at: new Date(at).toISOString(),
      valid_until: new Date(at + 120000).toISOString(),
      starts_on: "2026-09-28",
      ends_on: "2026-10-18",
      days: calendar.map((d) => ({
        ...d,
        kind: d.is_open ? "regular" : "non_trading",
      })),
    },
    observations: ["2026-10-09", "2026-10-16"].map((day, i) => ({
      record_id: id(i + 10),
      asset_id: asset,
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
        validUntilEpoch: at / 1000 + 120,
      },
    })),
  };
}
function edition() {
  return createEdition(
    period,
    evidence(),
    securities,
    [
      {
        id: id(20),
        security_id: asset,
        transaction_kind: "buy",
        traded_on: "2026-10-01",
        created_at: "2026-10-01T10:00:00Z",
        quantity: "10",
        unit_price: "90",
      },
    ],
    [],
    now,
  );
}

export { id, user, asset, now, period, securities, evidence, edition };
