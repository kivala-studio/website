export type ActivityKind =
  | "asset_view"
  | "search_select"
  | "comparison"
  | "chart_range"
  | "watchlist_add"
  | "watchlist_remove"
  | "wrap_open";
export type ActivityEvent = {
  kind: ActivityKind;
  securityID?: string;
  relatedID?: string;
  variant?: string;
};
export type ActivityAggregate = {
  user_id: string;
  installation_id: string;
  activity_day: string;
  kind: string;
  security_id: string | null;
  related_security_id: string | null;
  variant: string;
  activity_count: number;
};
export const activityDay = (now: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
export const isUUID = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
export function validActivity(event: ActivityEvent) {
  if (event.kind === "wrap_open")
    return !event.securityID && !event.relatedID && !event.variant;
  if (!isUUID(event.securityID)) return false;
  if (event.kind === "comparison")
    return (
      isUUID(event.relatedID) &&
      event.relatedID !== event.securityID &&
      !event.variant
    );
  if (event.relatedID) return false;
  if (event.kind === "chart_range")
    return ["1D", "1S", "1M", "3M", "6M", "1A", "Tudo"].includes(
      event.variant || "",
    );
  return (
    [
      "asset_view",
      "search_select",
      "watchlist_add",
      "watchlist_remove",
    ].includes(event.kind) && !event.variant
  );
}
export function aggregateKey(row: ActivityAggregate) {
  return JSON.stringify([
    row.installation_id,
    row.activity_day,
    row.kind,
    row.security_id,
    row.related_security_id,
    row.variant,
  ]);
}
/** Same bounded attention weights as iOS; not an investment recommendation. */
export function behavioralInterest(
  rows: ActivityAggregate[],
  userID: string,
  now: number,
  since = 0,
): Record<string, number> {
  const weights: Record<string, number> = {
    asset_view: 1,
    search_select: 1,
    comparison: 2,
    chart_range: 0.25,
  };
  const daily = new Map<
    string,
    { asset: string; at: number; weight: number; count: number }
  >();
  for (const row of rows) {
    const at = Date.parse(`${row.activity_day}T00:00:00+01:00`);
    const weight = weights[row.kind];
    if (
      row.user_id !== userID ||
      !weight ||
      !Number.isFinite(at) ||
      at > now ||
      at < since ||
      now - at >= 112 * 86400000 ||
      !Number.isInteger(row.activity_count) ||
      row.activity_count < 1
    )
      continue;
    for (const asset of new Set(
      [
        row.security_id,
        row.kind === "comparison" ? row.related_security_id : null,
      ].filter(isUUID),
    )) {
      const key = `${row.activity_day}:${row.kind}:${asset}`;
      const count = Math.min(
        3,
        (daily.get(key)?.count || 0) + row.activity_count,
      );
      daily.set(key, { asset, at, weight, count });
    }
  }
  const result: Record<string, number> = {};
  for (const entry of daily.values())
    result[entry.asset] = Math.min(
      8,
      (result[entry.asset] || 0) +
        entry.count *
          entry.weight *
          Math.pow(0.5, (now - entry.at) / (28 * 86400000)),
    );
  return result;
}
export type InterestProfile = {
  held: string[];
  watched: string[];
  alerts: string[];
  behavior: Record<string, number>;
};
export const emptyInterests: InterestProfile = {
  held: [],
  watched: [],
  alerts: [],
  behavior: {},
};
export function interestWeight(profile: InterestProfile, assets: string[]) {
  const relation = profile.held.some((id) => assets.includes(id))
    ? 80
    : profile.watched.some((id) => assets.includes(id))
      ? 40
      : profile.alerts.some((id) => assets.includes(id))
        ? 20
        : 0;
  return (
    relation +
    Math.floor(
      Math.min(
        8,
        Math.max(0, ...assets.map((id) => profile.behavior[id] || 0)),
      ),
    )
  );
}
