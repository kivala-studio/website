import type { EpochMs } from "../market/zone";
import type { InsightType } from "./models";

/*
 * Operational boundaries shared with the backend (iOS `IntelligenceFeatureConfiguration.swift`,
 * `IntelligenceFeatureControlStore.swift`). The document is `intelligence_feature_configuration.payload`
 * (contract §3.12). Missing, invalid or expired → optional features off, known kill switches kept.
 */

export const INTELLIGENCE_FEATURES = [
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
export type IntelligenceFeature = (typeof INTELLIGENCE_FEATURES)[number];

const DEPENDENCIES: Partial<Record<IntelligenceFeature, readonly IntelligenceFeature[]>> = {
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
  notification_watchlist: ["intelligence_notifications", "insight_engine", "price_changes"],
  notification_movement: ["intelligence_notifications", "insight_engine", "price_changes"],
  notification_market_recap: ["intelligence_notifications"],
};

export const featureDependencies = (feature: IntelligenceFeature): readonly IntelligenceFeature[] => DEPENDENCIES[feature] ?? [];

const SAFE_DEFAULTS: ReadonlySet<IntelligenceFeature> = new Set([
  "insight_engine",
  "snapshot_capture",
  "market_events",
  "activity_center",
  "personalization_engine",
  "personalized_home",
  "price_changes",
  "watchlist_breadth",
  "portfolio_performance",
  "portfolio_allocation",
  "watchlist_patterns",
  "publications",
  "weekly_wrap",
]);

export const safeDefault = (feature: IntelligenceFeature) => SAFE_DEFAULTS.has(feature);

export const INTELLIGENCE_AUDIENCES = ["production", "beta", "internal"] as const;
export type IntelligenceAudience = (typeof INTELLIGENCE_AUDIENCES)[number];

/** `production` on the live site; every other build (local, demo, previews) is `internal`. */
export function intelligenceAudience(dataMode: string | undefined, deploymentEnvironment: string | undefined): IntelligenceAudience {
  return dataMode === "production" && (deploymentEnvironment === undefined || deploymentEnvironment === "production") ? "production" : "internal";
}

/**
 * The website has no build number: it always runs the newest code, so `minimum_app_build` (an iOS build gate)
 * never excludes it. The largest value the document may carry.
 */
export const WEB_APP_BUILD = 2_147_483_647;

export interface IntelligenceFeatureRule {
  readonly enabled: boolean;
  readonly killSwitch: boolean;
  readonly rolloutPercentage: number;
  readonly rolloutSalt: string;
  readonly audiences: readonly IntelligenceAudience[];
}

export interface IntelligenceFeatureConfiguration {
  readonly schemaVersion: number;
  readonly version: number;
  readonly minimumAppBuild: number;
  readonly effectiveAt: EpochMs;
  readonly expiresAt: EpochMs;
  readonly features: Readonly<Record<string, IntelligenceFeatureRule>>;
}

export class InvalidFeatureConfiguration extends Error {
  constructor() {
    super("invalidConfiguration");
    this.name = "InvalidFeatureConfiguration";
  }
}

const ROOT_KEYS = ["effective_at", "expires_at", "features", "minimum_app_build", "schema_version", "version"];
const RULE_KEYS = ["audiences", "enabled", "kill_switch", "rollout_percentage", "rollout_salt"];
const MAXIMUM_BYTES = 32_768;
const INT32_MAX = 2_147_483_647;
const DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const SALT = /^[0-9A-Za-z_-]{1,64}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const sameKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const own = Object.keys(value).sort();
  const expected = [...keys].sort();
  return own.length === expected.length && own.every((key, index) => key === expected[index]);
};
const integer = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new InvalidFeatureConfiguration();
  return value;
};
const boolean = (value: unknown): boolean => {
  if (typeof value !== "boolean") throw new InvalidFeatureConfiguration();
  return value;
};

/** Seconds precision must survive a round trip, so impossible calendar dates (30 February) fail. */
function date(value: unknown): EpochMs {
  if (typeof value !== "string" || !DATE.test(value)) throw new InvalidFeatureConfiguration();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 19) !== value.slice(0, 19)) throw new InvalidFeatureConfiguration();
  return parsed;
}

function rule(value: unknown): IntelligenceFeatureRule {
  if (!isRecord(value) || !sameKeys(value, RULE_KEYS)) throw new InvalidFeatureConfiguration();
  const audiences = value.audiences;
  if (!Array.isArray(audiences) || !audiences.every((audience) => (INTELLIGENCE_AUDIENCES as readonly unknown[]).includes(audience))) {
    throw new InvalidFeatureConfiguration();
  }
  if (typeof value.rollout_salt !== "string") throw new InvalidFeatureConfiguration();
  return {
    enabled: boolean(value.enabled),
    killSwitch: boolean(value.kill_switch),
    rolloutPercentage: integer(value.rollout_percentage),
    rolloutSalt: value.rollout_salt,
    audiences: audiences as IntelligenceAudience[],
  };
}

/** Rejects unknown fields as well as omissions: a partial document cannot silently enable a feature. */
export function decodeFeatureConfiguration(text: string): IntelligenceFeatureConfiguration {
  if (new TextEncoder().encode(text).length > MAXIMUM_BYTES) throw new InvalidFeatureConfiguration();
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    throw new InvalidFeatureConfiguration();
  }
  if (!isRecord(root) || !sameKeys(root, ROOT_KEYS) || !isRecord(root.features) || !sameKeys(root.features, INTELLIGENCE_FEATURES)) {
    throw new InvalidFeatureConfiguration();
  }
  const features: Record<string, IntelligenceFeatureRule> = {};
  for (const [key, value] of Object.entries(root.features)) features[key] = rule(value);
  const result: IntelligenceFeatureConfiguration = {
    schemaVersion: integer(root.schema_version),
    version: integer(root.version),
    minimumAppBuild: integer(root.minimum_app_build),
    effectiveAt: date(root.effective_at),
    expiresAt: date(root.expires_at),
    features,
  };
  if (
    result.schemaVersion !== 1 ||
    result.version <= 0 ||
    result.version > INT32_MAX ||
    result.minimumAppBuild < 0 ||
    result.minimumAppBuild > INT32_MAX ||
    !(result.expiresAt > result.effectiveAt) ||
    result.expiresAt - result.effectiveAt > 7 * 86_400_000
  ) {
    throw new InvalidFeatureConfiguration();
  }
  for (const value of Object.values(features)) {
    if (
      value.rolloutPercentage < 0 ||
      value.rolloutPercentage > 100 ||
      !SALT.test(value.rolloutSalt) ||
      value.audiences.length === 0 ||
      new Set(value.audiences).size !== value.audiences.length
    ) {
      throw new InvalidFeatureConfiguration();
    }
  }
  return result;
}

export const isConfigurationActive = (configuration: IntelligenceFeatureConfiguration, now: EpochMs, appBuild: number) =>
  Number.isFinite(now) && now >= configuration.effectiveAt && now < configuration.expiresAt && appBuild >= configuration.minimumAppBuild;

export type AvailabilityReason = "enabled" | "localDefault" | "disabled" | "killed" | "cohortExcluded" | "dependencyDisabled" | "untrusted";
export type PersonalizationVersion = "significance" | "v1" | "v2";

export interface AvailabilityDecision {
  readonly remote: IntelligenceFeatureRule | null;
  readonly included: boolean;
  readonly enabled: boolean;
  readonly reason: AvailabilityReason;
}

export interface IntelligenceAvailability {
  readonly configurationVersion: number | null;
  readonly trusted: boolean;
  readonly decisions: Readonly<Record<IntelligenceFeature, AvailabilityDecision>>;
}

export const allows = (availability: IntelligenceAvailability, feature: IntelligenceFeature) => availability.decisions[feature]?.enabled === true;

export function personalizationVersion(availability: IntelligenceAvailability): PersonalizationVersion {
  if (!allows(availability, "personalization_engine")) return "significance";
  return allows(availability, "personalization_v2") ? "v2" : "v1";
}

/** FNV-1a 32-bit over UTF-8 `identity|feature|salt`, modulo 10000. The identity never leaves the browser. */
export function rolloutBucket(identity: string, feature: IntelligenceFeature, salt: string): number {
  let hash = 2_166_136_261;
  for (const byte of new TextEncoder().encode(`${identity}|${feature}|${salt}`)) hash = Math.imul(hash ^ byte, 16_777_619) >>> 0;
  return hash % 10_000;
}

export interface ResolveAvailability {
  readonly configuration: IntelligenceFeatureConfiguration | null;
  readonly identity: string;
  readonly audience: IntelligenceAudience;
  readonly appBuild: number;
  readonly now: EpochMs;
  readonly notificationsTrusted?: boolean;
}

export function resolveAvailability({
  configuration,
  identity,
  audience,
  appBuild,
  now,
  notificationsTrusted = true,
}: ResolveAvailability): IntelligenceAvailability {
  const active = configuration !== null && isConfigurationActive(configuration, now, appBuild);
  const decisions = new Map<IntelligenceFeature, AvailabilityDecision>();
  const decide = (feature: IntelligenceFeature): AvailabilityDecision => {
    const existing = decisions.get(feature);
    if (existing) return existing;
    const remote = configuration?.features[feature] ?? null;
    const included = remote
      ? remote.audiences.includes(audience) && rolloutBucket(identity, feature, remote.rolloutSalt) < remote.rolloutPercentage * 100
      : false;
    let enabled = active ? remote?.enabled === true && remote.killSwitch === false && included : safeDefault(feature);
    let reason: AvailabilityReason = active ? "enabled" : "localDefault";
    // Every known restrictive decision survives an expired document or an unsupported build.
    if (remote) {
      if (remote.killSwitch) [enabled, reason] = [false, "killed"];
      else if (!remote.enabled) [enabled, reason] = [false, "disabled"];
      else if (!included) [enabled, reason] = [false, "cohortExcluded"];
    }
    if (feature === "intelligence_notifications" && (!active || !notificationsTrusted)) [enabled, reason] = [false, "untrusted"];
    if (enabled && featureDependencies(feature).some((dependency) => !decide(dependency).enabled)) [enabled, reason] = [false, "dependencyDisabled"];
    const result = { remote, included, enabled, reason };
    decisions.set(feature, result);
    return result;
  };
  for (const feature of INTELLIGENCE_FEATURES) decide(feature);
  return {
    configurationVersion: configuration?.version ?? null,
    trusted: active,
    decisions: Object.fromEntries(decisions) as Record<IntelligenceFeature, AvailabilityDecision>,
  };
}

const TYPE_FEATURE: Record<InsightType, IntelligenceFeature> = {
  assetPriceChange: "price_changes",
  watchlistBreadth: "watchlist_breadth",
  portfolioPricePerformance: "portfolio_performance",
  portfolioAllocation: "portfolio_allocation",
  watchlistMovement: "watchlist_patterns",
  watchlistSessionRun: "watchlist_patterns",
  watchlistClosingExtreme: "watchlist_patterns",
  watchlistInformation: "publications",
  marketInformation: "publications",
};

export const permitsInsightType = (availability: IntelligenceAvailability, type: InsightType) => allows(availability, TYPE_FEATURE[type]);

/** No document at all: the safe defaults (core facts and the Weekly Wrap on, experiments and pushes off). */
export const DEFAULT_AVAILABILITY = resolveAvailability({ configuration: null, identity: "local", audience: "production", appBuild: WEB_APP_BUILD, now: 0 });

// MARK: Store

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface FeatureControlOptions {
  /** The raw `payload` jsonb of the single configuration row. */
  readonly fetch: (now: EpochMs) => Promise<unknown>;
  readonly storage: KeyValueStorage | null;
  readonly audience: IntelligenceAudience;
  readonly appBuild?: number;
  readonly now: EpochMs;
  readonly randomID?: () => string;
}

const IDENTITY_KEY = "intelligence-rollout-installation-v1";
const CACHE_KEY = "intelligence-feature-configuration-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FRESH_MS = 300_000;
const RETRY_MS = 60_000;

/** Stable JSON with sorted keys: equal documents compare equal however the server ordered them. */
export function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const read = (storage: KeyValueStorage | null, key: string) => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};
const write = (storage: KeyValueStorage | null, key: string, value: string) => {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage blocked: the browser keeps working from memory.
  }
};

/**
 * Install-scoped operational state; contains no account or financial information. The last valid document is
 * kept across failed or malformed fetches, so known kill switches are never forgotten.
 */
export class FeatureControlStore {
  fetchFailed = false;
  validationFailed = false;
  fetchedAt: EpochMs | null = null;

  private readonly options: FeatureControlOptions;
  private readonly identity: string;
  private readonly appBuild: number;
  private configuration: IntelligenceFeatureConfiguration | null = null;
  private payload: string | null = null;
  private attemptedAt: EpochMs | null = null;
  private fetching = false;
  private notificationsTrusted = false;

  constructor(options: FeatureControlOptions) {
    this.options = options;
    this.appBuild = options.appBuild ?? WEB_APP_BUILD;
    const saved = read(options.storage, IDENTITY_KEY);
    if (saved && UUID.test(saved)) {
      this.identity = saved;
    } else {
      this.identity = (options.randomID ?? (() => crypto.randomUUID()))().toLowerCase();
      write(options.storage, IDENTITY_KEY, this.identity);
    }
    const cached = read(options.storage, CACHE_KEY);
    if (cached) {
      try {
        const parsed: unknown = JSON.parse(cached);
        if (
          isRecord(parsed) &&
          typeof parsed.payload === "string" &&
          typeof parsed.fetchedAt === "number" &&
          Number.isFinite(parsed.fetchedAt) &&
          parsed.fetchedAt <= options.now
        ) {
          this.configuration = decodeFeatureConfiguration(parsed.payload);
          this.payload = parsed.payload;
          this.fetchedAt = parsed.fetchedAt;
        }
      } catch {
        // An unreadable cache is ignored; the safe defaults apply until a fetch succeeds.
      }
    }
  }

  availability(now: EpochMs): IntelligenceAvailability {
    const fresh = this.fetchedAt !== null && now >= this.fetchedAt && now - this.fetchedAt < FRESH_MS;
    return resolveAvailability({
      configuration: this.configuration,
      identity: this.identity,
      audience: this.options.audience,
      appBuild: this.appBuild,
      now,
      notificationsTrusted: this.notificationsTrusted && fresh,
    });
  }

  async refresh(now: EpochMs, force = false): Promise<void> {
    if (!Number.isFinite(now) || this.fetching) return;
    if (!force && this.attemptedAt !== null && now >= this.attemptedAt && now - this.attemptedAt < RETRY_MS) return;
    if (
      !force &&
      !this.fetchFailed &&
      !this.validationFailed &&
      this.fetchedAt !== null &&
      now >= this.fetchedAt &&
      now - this.fetchedAt < FRESH_MS &&
      this.configuration !== null &&
      isConfigurationActive(this.configuration, now, this.appBuild)
    ) {
      return;
    }
    this.fetching = true;
    this.attemptedAt = now;
    let raw: unknown;
    try {
      raw = await this.options.fetch(now);
    } catch {
      this.fetchFailed = true;
      this.validationFailed = false;
      this.notificationsTrusted = false;
      this.fetching = false;
      return;
    }
    this.fetching = false;
    const canonical = canonicalJSON(raw);
    let valid: IntelligenceFeatureConfiguration;
    try {
      valid = decodeFeatureConfiguration(typeof raw === "string" ? raw : canonical);
    } catch {
      return this.reject();
    }
    const text = typeof raw === "string" ? canonicalJSON(JSON.parse(raw)) : canonical;
    const previous = this.configuration?.version ?? 0;
    if (
      !isConfigurationActive(valid, now, this.appBuild) ||
      valid.version < previous ||
      (valid.version === this.configuration?.version && text !== this.payload)
    ) {
      return this.reject();
    }
    this.configuration = valid;
    this.payload = text;
    this.fetchedAt = now;
    this.fetchFailed = false;
    this.validationFailed = false;
    this.notificationsTrusted = true;
    write(this.options.storage, CACHE_KEY, JSON.stringify({ payload: text, fetchedAt: now }));
  }

  private reject() {
    this.validationFailed = true;
    this.fetchFailed = false;
    this.notificationsTrusted = false;
  }
}
