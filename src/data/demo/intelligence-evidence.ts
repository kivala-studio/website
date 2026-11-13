import "server-only";

import { type DemoScenario, demoSnapshot, recordedSnapshot } from "@/data/market/demo/scenarios";
import { sha256Hex } from "@/domain/intelligence/sha256";
import { type EpochMs, DAY_MS, MINUTE_MS, SECOND_MS, civilDate, dayStart } from "@/domain/market/zone";

/*
 * Demo `get_market_period_evidence` (contract v3), shaped exactly as the RPC answers: the demo market calendar
 * sliced to [period start − 14 days, period end], its day list, and one final, provenanced close per session for
 * every instrument with a recorded close. Closes follow a deterministic walk around the recorded close, so the
 * demo watchlist and ledger see real weekly movements, runs and extremes. Demo mode only.
 */

type Row = Record<string, unknown>;

const iso = (instant: EpochMs) => new Date(instant).toISOString();

/** Mulberry32 over a string seed, as the other demo series use. */
function seeded(seed: string): () => number {
  let state = [...seed].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 2_654_435_761) >>> 0, 2_166_136_261);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const bonds = new Set(recordedSnapshot.securities.filter((row) => row.security_type === "bond" || row.security_type === "treasury_bond").map((row) => row.id));

/** The same close for an instrument and day on every request: a slow swing plus daily noise. */
function demoClose(securityID: string, base: number, day: EpochMs): string {
  const bond = bonds.has(securityID);
  const phase = seeded(securityID)() * 2 * Math.PI;
  const swing = Math.sin(Math.round(day / DAY_MS) / 4 + phase) * (bond ? 0.01 : 0.06);
  const noise = (seeded(`${securityID}:${civilDate(day)}`)() - 0.5) * 2 * (bond ? 0.002 : 0.012);
  return (base * (1 + swing + noise)).toFixed(bond ? 2 : 0);
}

const minuteOf = (value: unknown) => {
  const [hour, minute] = String(value).split(":").map(Number);
  return hour * 60 + minute;
};

const isOpen = (day: Row) => day.kind === "regular" || day.kind === "exceptional_session";

/** The RPC response for `starts_on`…`ends_on` (inclusive Luanda days) at `now`. */
export function demoMarketPeriodEvidence(scenario: DemoScenario, startsOn: string, endsOn: string, now: EpochMs): Row {
  const fetchedAt = now - SECOND_MS;
  const start = dayStart(startsOn);
  const last = dayStart(endsOn);
  const insufficient = { contract_version: 3, fetched_at: iso(fetchedAt), baseline_day: null, calendar: [], observations: [], calendar_snapshot: null };
  if (start === undefined || last === undefined || last < start) return insufficient;
  const first = start - 14 * DAY_MS;
  const end = last + DAY_MS;
  const snapshot = demoSnapshot(scenario, now);
  const calendar = snapshot.calendar as Row;
  const days = (calendar.days as Row[]).filter((day) => {
    const at = dayStart(String(day.day));
    return at !== undefined && at >= first && at < end;
  });
  if (days.length !== Math.round((end - first) / DAY_MS)) return insufficient;
  const baseline = days.filter((day) => isOpen(day) && dayStart(String(day.day))! < start).at(-1);
  const closes = (snapshot.closes as Row[]).map((row) => ({ id: String(row.security_id), price: Number(row.price) }));
  const observations: Row[] = [];
  for (const day of days.filter(isOpen)) {
    const midnight = dayStart(String(day.day))!;
    const observedAt = midnight + minuteOf(day.closes_at) * MINUTE_MS;
    const collectedAt = observedAt + MINUTE_MS;
    if (collectedAt > fetchedAt) continue;
    for (const { id, price } of closes) {
      const recordID = `price_history:${id}:${String(day.day)}`;
      const close = demoClose(id, price, midnight);
      observations.push({
        record_id: recordID,
        asset_id: id,
        currency_code: "AOA",
        price: close,
        observed_at: iso(observedAt),
        collected_at: iso(collectedAt),
        ingestion_run_id: `demo-run-${String(day.day)}`,
        source_sha256: sha256Hex(`${recordID}:${close}`),
        parser_version: "demo-1",
        dataset: "price_history.close_price",
        is_final: true,
        data_quality: { status: "valid", reasons: [] },
      });
    }
  }
  return {
    contract_version: 3,
    fetched_at: iso(fetchedAt),
    baseline_day: baseline ? baseline.day : null,
    calendar: days.map((day) => ({
      day: day.day,
      is_open: isOpen(day),
      opens_at: isOpen(day) ? day.opens_at : null,
      closes_at: isOpen(day) ? day.closes_at : null,
      revision: null,
    })),
    observations,
    calendar_snapshot: {
      ...calendar,
      days,
      starts_on: civilDate(first),
      ends_on: endsOn,
      fetched_at: iso(fetchedAt),
      valid_until: iso(now + 90 * SECOND_MS),
    },
  };
}
