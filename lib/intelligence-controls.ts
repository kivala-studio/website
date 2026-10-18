export const featureNames = [
  "insight_engine",
  "snapshot_capture",
  "market_events",
  "weekly_wrap",
  "saturday_discover",
  "week_ahead",
  "personalized_home",
  "activity_center",
  "intelligence_notifications",
  "personalization_engine",
  "personalization_v2",
  "price_changes",
  "watchlist_breadth",
  "portfolio_performance",
  "portfolio_allocation",
  "watchlist_patterns",
  "publications",
  "notification_watchlist",
  "notification_movement",
  "notification_market_recap",
] as const;
type Feature = (typeof featureNames)[number];
type Rule = {
  enabled: boolean;
  kill_switch: boolean;
  rollout_percentage: number;
  rollout_salt: string;
  audiences: string[];
};
export type IntelligenceControls = {
  schema_version: 1;
  version: number;
  minimum_app_build: number;
  effective_at: string;
  expires_at: string;
  features: Record<Feature, Rule>;
};
const keysEqual = (obj: object, keys: readonly string[]) =>
  Object.keys(obj).sort().join("|") === [...keys].sort().join("|");
export function parseControls(value: unknown): IntelligenceControls {
  const c = value as IntelligenceControls;
  if (
    !c ||
    JSON.stringify(c).length > 32768 ||
    !keysEqual(c, [
      "schema_version",
      "version",
      "minimum_app_build",
      "effective_at",
      "expires_at",
      "features",
    ]) ||
    c.schema_version !== 1 ||
    !Number.isInteger(c.version) ||
    c.version < 1 ||
    c.version > 2147483647 ||
    !Number.isInteger(c.minimum_app_build) ||
    c.minimum_app_build < 0 ||
    c.minimum_app_build > 2147483647 ||
    !Number.isFinite(Date.parse(c.effective_at)) ||
    !Number.isFinite(Date.parse(c.expires_at)) ||
    Date.parse(c.expires_at) <= Date.parse(c.effective_at) ||
    Date.parse(c.expires_at) - Date.parse(c.effective_at) > 7 * 86400000 ||
    !c.features ||
    !keysEqual(c.features, featureNames)
  )
    throw new Error("Unsupported intelligence controls");
  for (const r of Object.values(c.features))
    if (
      !r ||
      !keysEqual(r, [
        "enabled",
        "kill_switch",
        "rollout_percentage",
        "rollout_salt",
        "audiences",
      ]) ||
      typeof r.enabled !== "boolean" ||
      typeof r.kill_switch !== "boolean" ||
      !Number.isInteger(r.rollout_percentage) ||
      r.rollout_percentage < 0 ||
      r.rollout_percentage > 100 ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(r.rollout_salt) ||
      !Array.isArray(r.audiences) ||
      !r.audiences.length ||
      new Set(r.audiences).size !== r.audiences.length ||
      r.audiences.some((a) => !["production", "beta", "internal"].includes(a))
    )
      throw new Error("Unsupported feature rule");
  return c;
}
export function cohortBucket(identity: string, feature: string, salt: string) {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(`${identity}|${feature}|${salt}`))
    hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash % 10000;
}
const dependencies: Partial<Record<Feature, Feature[]>> = {
  weekly_wrap: ["insight_engine", "snapshot_capture"],
  saturday_discover: ["insight_engine", "personalization_engine"],
  week_ahead: ["market_events"],
  personalized_home: ["personalization_engine"],
  personalization_v2: ["personalization_engine"],
  price_changes: ["insight_engine"],
  watchlist_breadth: ["insight_engine"],
  portfolio_performance: ["insight_engine"],
  portfolio_allocation: ["insight_engine"],
  watchlist_patterns: ["insight_engine"],
  publications: ["insight_engine"],
  notification_watchlist: [
    "intelligence_notifications",
    "insight_engine",
    "price_changes",
  ],
  notification_movement: [
    "intelligence_notifications",
    "insight_engine",
    "price_changes",
  ],
  notification_market_recap: ["intelligence_notifications"],
};
const disabledDefaults: Feature[] = [
  "saturday_discover",
  "week_ahead",
  "intelligence_notifications",
  "personalization_v2",
  "notification_watchlist",
  "notification_movement",
  "notification_market_recap",
];
export function controlEnabled(
  config: IntelligenceControls,
  identity: string,
  feature: Feature,
  now: number,
): boolean {
  const rule = config.features[feature],
    included =
      rule.audiences.includes("production") &&
      cohortBucket(identity, feature, rule.rollout_salt) <
        rule.rollout_percentage * 100;
  if (rule.kill_switch || !rule.enabled || !included) return false;
  // Web has no iOS build number. Unsupported native build gates retain restrictive rules and safe defaults.
  const active =
    Date.parse(config.effective_at) <= now &&
    now < Date.parse(config.expires_at) &&
    config.minimum_app_build === 0;
  if (!active && disabledDefaults.includes(feature)) return false;
  return (dependencies[feature] || []).every((f) =>
    controlEnabled(config, identity, f, now),
  );
}
export function familyEnabled(
  config: IntelligenceControls,
  identity: string,
  family: string,
  now: number,
) {
  const feature: Feature = (
    {
      portfolioPricePerformance: "portfolio_performance",
      portfolioAllocation: "portfolio_allocation",
      watchlistBreadth: "watchlist_breadth",
      watchlistMovement: "watchlist_patterns",
      watchlistSessionRun: "watchlist_patterns",
      watchlistClosingExtreme: "watchlist_patterns",
      watchlistInformation: "publications",
      assetPriceChange: "price_changes",
    } as Record<string, Feature>
  )[family];
  return !!feature && controlEnabled(config, identity, feature, now);
}
