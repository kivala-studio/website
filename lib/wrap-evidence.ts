import Decimal from "decimal.js";
import type { Quality, Security } from "./public-data";
export type WrapWindow = {
  period_type: string;
  starts_on: string;
  ends_on: string;
  available_at: string;
  expires_at: string;
};
type Day = {
  day: string;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
};
export type WrapEvidence = {
  contract_version: number;
  baseline_day: string | null;
  fetched_at: string;
  calendar: Day[];
  calendar_snapshot: {
    contract_version: number;
    timezone: string;
    source: string;
    fetched_at: string;
    valid_until: string;
    starts_on: string;
    ends_on: string;
    days: {
      day: string;
      kind: string;
      opens_at: string | null;
      closes_at: string | null;
    }[];
  };
  observations: {
    record_id: string;
    ingestion_run_id?: string;
    asset_id: string;
    currency_code: string;
    dataset: string;
    price: string;
    observed_at: string;
    collected_at: string;
    is_final: boolean;
    source_sha256: string;
    parser_version: string;
    data_quality: Quality;
  }[];
};
const dayMs = 86400000;
const validDay = (day: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  Number.isFinite(Date.parse(day)) &&
  new Date(day).toISOString().slice(0, 10) === day;
const luandaDay = (instant: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
/** Evidence is displayable only while its verified calendar and source quality are valid. */
export function wrapRows(
  evidence: WrapEvidence | null,
  period: WrapWindow,
  securities: Security[],
  now: number,
  context: "release" | "historical-repair" | "insight" = "release",
) {
  if (
    !evidence ||
    !Number.isFinite(now) ||
    evidence.contract_version !== 3 ||
    !validDay(period.starts_on) ||
    !validDay(period.ends_on) ||
    Date.parse(period.available_at) > now ||
    (context === "release" && !(Date.parse(period.expires_at) > now)) ||
    (context === "historical-repair" &&
      (Date.parse(period.ends_on) > now ||
        now - Date.parse(period.ends_on) >= 730 * dayMs))
  )
    return null;
  const snapshot = evidence.calendar_snapshot;
  const first = new Date(Date.parse(period.starts_on) - 14 * dayMs)
    .toISOString()
    .slice(0, 10);
  const expectedCount =
    (Date.parse(period.ends_on) - Date.parse(first)) / dayMs + 1;
  if (
    !snapshot ||
    snapshot.contract_version !== 2 ||
    snapshot.timezone !== "Africa/Luanda" ||
    !/^https:\/\//.test(snapshot.source) ||
    snapshot.starts_on !== first ||
    snapshot.ends_on !== period.ends_on ||
    !(Date.parse(snapshot.valid_until) > now) ||
    !(Date.parse(snapshot.fetched_at) <= now) ||
    !(Date.parse(evidence.fetched_at) <= now) ||
    now - Date.parse(evidence.fetched_at) >= 15 * 60000 ||
    evidence.calendar.length !== expectedCount ||
    snapshot.days.length !== expectedCount
  )
    return null;
  for (let i = 0; i < expectedCount; i++) {
    const expected = new Date(Date.parse(first) + i * dayMs)
      .toISOString()
      .slice(0, 10);
    const day = evidence.calendar[i],
      verified = snapshot.days[i];
    if (
      day.day !== expected ||
      verified.day !== expected ||
      verified.kind === "unknown" ||
      day.is_open !== !!verified.opens_at ||
      day.opens_at !== verified.opens_at ||
      day.closes_at !== verified.closes_at
    )
      return null;
    if (
      day.is_open &&
      (!day.opens_at ||
        !day.closes_at ||
        day.opens_at >= day.closes_at ||
        Date.parse(`${day.day}T${day.closes_at}+01:00`) > now)
    )
      return null;
  }
  const baseline = evidence.calendar
    .filter((d) => d.is_open && d.day < period.starts_on)
    .at(-1)?.day;
  const end = evidence.calendar
    .filter(
      (d) => d.is_open && d.day >= period.starts_on && d.day <= period.ends_on,
    )
    .at(-1)?.day;
  if (!baseline || !end || evidence.baseline_day !== baseline) return null;
  const sessions = evidence.calendar.filter(
    (d) => d.is_open && d.day >= baseline && d.day <= end,
  );
  const recordIDs = new Set<string>();
  if (
    evidence.observations.some((o) => {
      if (recordIDs.has(o.record_id)) return true;
      recordIDs.add(o.record_id);
      return false;
    })
  )
    return null;
  return securities
    .flatMap((security) => {
      const series = evidence.observations
        .filter(
          (o) =>
            o.asset_id === security.id &&
            Date.parse(o.observed_at) >=
              Date.parse(`${baseline}T00:00:00+01:00`) &&
            Date.parse(o.observed_at) <
              Date.parse(`${end}T00:00:00+01:00`) + dayMs,
        )
        .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
      if (
        series.length !== sessions.length ||
        series.some(
          (o, i) =>
            Date.parse(o.observed_at) !==
            Date.parse(`${sessions[i].day}T${sessions[i].closes_at}+01:00`),
        )
      )
        return [];
      const eligible = series.filter(
        (o) =>
          o.asset_id === security.id &&
          o.currency_code === security.currency &&
          o.dataset.startsWith("price_history.") &&
          o.is_final &&
          !!o.record_id &&
          !!o.ingestion_run_id &&
          Number.isFinite(Number(o.price)) &&
          Number(o.price) > 0 &&
          /^[a-f0-9]{64}$/i.test(o.source_sha256) &&
          o.parser_version &&
          Date.parse(o.observed_at) <= now &&
          Date.parse(o.collected_at) <= now &&
          Date.parse(o.collected_at) <= Date.parse(evidence.fetched_at) &&
          Date.parse(o.collected_at) >= Date.parse(o.observed_at) &&
          o.data_quality?.status === "valid" &&
          o.data_quality.reasons.length === 0 &&
          (!o.data_quality.validUntilEpoch ||
            o.data_quality.validUntilEpoch * 1000 > now),
      );
      if (eligible.length !== series.length) return [];
      const startPoints = eligible.filter(
          (o) => luandaDay(o.observed_at) === baseline,
        ),
        endPoints = eligible.filter((o) => luandaDay(o.observed_at) === end);
      if (startPoints.length !== 1 || endPoints.length !== 1) return [];
      const start = Number(startPoints[0].price),
        finish = Number(endPoints[0].price);
      return [
        {
          security,
          change: new Decimal(endPoints[0].price)
            .div(startPoints[0].price)
            .minus(1)
            .times(100)
            .toNumber(),
          start,
          end: finish,
          records: [startPoints[0].record_id, endPoints[0].record_id],
          series,
        },
      ];
    })
    .sort((a, b) => b.change - a.change);
}
