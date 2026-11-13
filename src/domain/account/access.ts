/** `get_subscription_access()` (contract §7.3; iOS `SubscriptionAccess`). Dates stay as the server sent them. */
export interface SubscriptionAccess {
  readonly isPlus: boolean;
  readonly enforcementEnabled: boolean;
  readonly weekStart: string | null;
  readonly resetsAt: string | null;
  /** The Free pair claimed this week. */
  readonly comparisonPair: readonly string[] | null;
  /** Watchlist rows that count for a Free account. */
  readonly activeWatchlistIDs: readonly string[];
  readonly movementSecurityID: string | null;
}

/** iOS `FreePlanLimits`. */
export const FREE_PLAN_LIMITS = {
  watchlist: 3,
  movementInstruments: 1,
  comparisonInstruments: 2,
  plusComparisonInstruments: 3,
  orderBookLevels: 5,
} as const;

const text = (value: unknown) => (typeof value === "string" ? value : null);
const ids = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

/** The RPC body, or null when it is not the access document. */
export function decodeSubscriptionAccess(body: unknown): SubscriptionAccess | null {
  if (typeof body !== "object" || body === null) return null;
  const row = body as Record<string, unknown>;
  if (typeof row.is_plus !== "boolean" || typeof row.enforcement_enabled !== "boolean") return null;
  return {
    isPlus: row.is_plus,
    enforcementEnabled: row.enforcement_enabled,
    weekStart: text(row.week_start),
    resetsAt: text(row.resets_at),
    comparisonPair: Array.isArray(row.comparison_pair) ? ids(row.comparison_pair) : null,
    activeWatchlistIDs: ids(row.active_watchlist_ids),
    movementSecurityID: text(row.movement_security_id),
  };
}

/**
 * iOS `unlocksPlusFeatures`: every feature is open unless the server enforces limits for this account; an
 * unknown access state never locks anything (the server still enforces). Plus is the only paid plan.
 */
export function unlocksPlus(access: SubscriptionAccess | null | undefined): boolean {
  return !access || !access.enforcementEnabled || access.isPlus;
}

/** Instruments a comparison may hold in total, the primary included. */
export const comparisonCapacity = (access: SubscriptionAccess | null | undefined) =>
  unlocksPlus(access) ? FREE_PLAN_LIMITS.plusComparisonInstruments : FREE_PLAN_LIMITS.comparisonInstruments;
