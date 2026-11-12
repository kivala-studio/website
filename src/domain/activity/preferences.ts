/*
 * Notification preferences shared with the apps (contract §4.5). No row means the defaults apply; daily close and
 * market recaps are opt-in.
 */

export const CATEGORY_PREFERENCES = [
  "watched_movements_enabled",
  "held_asset_movements_enabled",
  "portfolio_daily_enabled",
  "listings_enabled",
  "daily_close_enabled",
  "public_previews_enabled",
] as const;
export type CategoryPreference = (typeof CATEGORY_PREFERENCES)[number];
export type CategoryPreferences = Readonly<Record<CategoryPreference, boolean>>;

export const DEFAULT_CATEGORY_PREFERENCES: CategoryPreferences = {
  watched_movements_enabled: true,
  held_asset_movements_enabled: true,
  portfolio_daily_enabled: true,
  listings_enabled: true,
  daily_close_enabled: false,
  public_previews_enabled: true,
};

/** Every rule name the server accepts in `disabled_rules`. */
export const UNUSUAL_RULES = [
  "large_trade",
  "large_order",
  "volume_spike",
  "trade_count_spike",
  "price_move",
  "dormancy_break",
  "spread_change",
  "spread_shift",
  "book_imbalance",
] as const;
export type UnusualRule = (typeof UNUSUAL_RULES)[number];
/** The rules a person can mute; order book shifts follow the spread and large-order switches (iOS). */
export const CONFIGURABLE_UNUSUAL_RULES = ["large_trade", "large_order", "volume_spike", "trade_count_spike", "price_move", "dormancy_break", "spread_change"] as const;
export const isUnusualRule = (value: unknown): value is UnusualRule => (UNUSUAL_RULES as readonly unknown[]).includes(value);

export interface UnusualPreferences {
  readonly enabled: boolean;
  /** Sorted, unique. */
  readonly disabledRules: readonly UnusualRule[];
}

export const DEFAULT_UNUSUAL_PREFERENCES: UnusualPreferences = { enabled: true, disabledRules: [] };

export interface NotificationPreferences {
  readonly categories: CategoryPreferences;
  readonly recaps: boolean;
  readonly unusual: UnusualPreferences;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  categories: DEFAULT_CATEGORY_PREFERENCES,
  recaps: false,
  unusual: DEFAULT_UNUSUAL_PREFERENCES,
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** A `notification_preferences` row, or the defaults; a missing column keeps its default. */
export function decodeCategoryPreferences(row: unknown): CategoryPreferences {
  if (!isRecord(row)) return DEFAULT_CATEGORY_PREFERENCES;
  return Object.fromEntries(
    CATEGORY_PREFERENCES.map((key) => [key, typeof row[key] === "boolean" ? row[key] : DEFAULT_CATEGORY_PREFERENCES[key]]),
  ) as CategoryPreferences;
}

export const normalizedRules = (rules: Iterable<unknown>): UnusualRule[] => [...new Set([...rules].filter(isUnusualRule))].sort();

/** An `unusual_activity_preferences` row, or the defaults. */
export function decodeUnusualPreferences(row: unknown): UnusualPreferences {
  if (!isRecord(row)) return DEFAULT_UNUSUAL_PREFERENCES;
  return {
    enabled: typeof row.notifications_enabled === "boolean" ? row.notifications_enabled : true,
    disabledRules: normalizedRules(Array.isArray(row.disabled_rules) ? row.disabled_rules : []),
  };
}

/** Mutes or unmutes one rule; the rules this page does not show are kept as stored. */
export function withRule(preferences: UnusualPreferences, rule: UnusualRule, enabled: boolean): UnusualPreferences {
  const rules = new Set(preferences.disabledRules);
  if (enabled) rules.delete(rule);
  else rules.add(rule);
  return { ...preferences, disabledRules: normalizedRules(rules) };
}

/** The browser's check of the preferences route. */
export function decodeNotificationPreferences(value: unknown): NotificationPreferences | null {
  if (!isRecord(value) || !isRecord(value.categories) || !isRecord(value.unusual) || typeof value.recaps !== "boolean") return null;
  const unusual = value.unusual;
  return {
    categories: decodeCategoryPreferences(value.categories),
    recaps: value.recaps,
    unusual: {
      enabled: unusual.enabled !== false,
      disabledRules: normalizedRules(Array.isArray(unusual.disabledRules) ? unusual.disabledRules : []),
    },
  };
}
