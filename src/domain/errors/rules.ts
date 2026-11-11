import type { ErrorMessageKey } from "./keys";

/** Business rules the backend raises as `P0001` with the code in `message` (contract §4, §5, §7). */
export const SERVER_RULE_CODES = [
  "FREE_WATCHLIST_LIMIT",
  "FREE_MOVEMENT_LIMIT",
  "PLUS_REQUIRED",
  "PRO_REQUIRED",
  "WATCHLIST_GROUP_LIMIT",
  "PORTFOLIO_LIMIT",
  "SHARE_LIMIT",
  "PORTFOLIO_NOT_FOUND",
  "FREE_COMPARISON_SIZE_LIMIT",
  "FREE_COMPARISON_WEEK_LIMIT",
  "COMPARISON_DATA_UNAVAILABLE",
  "REFERRALS_UNAVAILABLE",
  "REFERRAL_CODE_INVALID",
  "REFERRAL_OWN_CODE",
  "REFERRAL_ALREADY_USED",
  "REFERRAL_NOT_ELIGIBLE",
] as const;

export type ServerRuleCode = (typeof SERVER_RULE_CODES)[number];

/** Paywall reasons, named as on iOS (`SubscriptionStore.UpgradeReason`). */
export type UpgradeReason =
  | "onboarding"
  | "watchlist"
  | "movement"
  | "comparison"
  | "portfolios"
  | "cash"
  | "alerts"
  | "watchlistGroups"
  | "history"
  | "priceExport"
  | "liquidity"
  | "orderBookDepth"
  | "clientViews";

export type Tier = "plus" | "pro";

export const UPGRADE_REASON_KEYS: Record<UpgradeReason, ErrorMessageKey> = {
  onboarding: "subscriptions.paywall.onboardingReason",
  watchlist: "subscriptions.paywall.watchlistReason",
  movement: "subscriptions.paywall.movementReason",
  comparison: "subscriptions.paywall.comparisonReason",
  portfolios: "subscriptions.paywall.portfoliosReason",
  cash: "subscriptions.paywall.cashReason",
  alerts: "subscriptions.paywall.alertsReason",
  watchlistGroups: "subscriptions.paywall.watchlistGroupsReason",
  history: "subscriptions.paywall.historyReason",
  priceExport: "subscriptions.paywall.priceExportReason",
  liquidity: "subscriptions.paywall.liquidityReason",
  orderBookDepth: "common.orderBook",
  clientViews: "portfolioShare.menu",
};

/** iOS `UpgradeReason.tier`. */
export const upgradeTier = (reason: UpgradeReason): Tier => (reason === "orderBookDepth" || reason === "clientViews" ? "pro" : "plus");

export type ServerRule = {
  readonly code: ServerRuleCode;
  /** `details.feature`, when sent. */
  readonly feature: string | null;
  /** `details.limit`: the count the account reached. */
  readonly limit: number | null;
  /** A higher tier lifts the rule: open the paywall with this reason. */
  readonly upgrade: { readonly reason: UpgradeReason; readonly tier: Tier } | null;
  /** Inline copy; null when the catalogue has none and the caller's generic copy applies. */
  readonly messageKey: ErrorMessageKey | null;
};

const PLUS_FEATURES: Record<string, UpgradeReason> = {
  watchlist_groups: "watchlistGroups",
  alert_rules: "alerts",
  portfolios: "portfolios",
  cash: "cash",
};

const RULES: Record<Exclude<ServerRuleCode, "PLUS_REQUIRED">, { upgrade?: UpgradeReason; messageKey: ErrorMessageKey | null }> = {
  FREE_WATCHLIST_LIMIT: { upgrade: "watchlist", messageKey: "market.watchlist.freePlanLimit" },
  FREE_MOVEMENT_LIMIT: { upgrade: "movement", messageKey: "alerts.error.freePlanLimit" },
  FREE_COMPARISON_SIZE_LIMIT: { upgrade: "comparison", messageKey: "subscriptions.access.comparisonSizeLimit" },
  FREE_COMPARISON_WEEK_LIMIT: { upgrade: "comparison", messageKey: "subscriptions.access.weeklyPairLimit" },
  COMPARISON_DATA_UNAVAILABLE: { messageKey: "subscriptions.access.insufficientData" },
  // The paywall reason is the only Pro copy; there is no inline message.
  PRO_REQUIRED: { upgrade: "clientViews", messageKey: null },
  WATCHLIST_GROUP_LIMIT: { messageKey: "site.watchlist.groupLimit" },
  PORTFOLIO_LIMIT: { messageKey: null },
  SHARE_LIMIT: { messageKey: "portfolioShare.limit" },
  PORTFOLIO_NOT_FOUND: { messageKey: "portfolioShare.failed" },
  REFERRALS_UNAVAILABLE: { messageKey: "referral.error.unavailable" },
  REFERRAL_CODE_INVALID: { messageKey: "referral.error.invalid" },
  REFERRAL_OWN_CODE: { messageKey: "referral.error.own" },
  REFERRAL_ALREADY_USED: { messageKey: "referral.error.used" },
  REFERRAL_NOT_ELIGIBLE: { messageKey: "referral.error.notEligible" },
};

const KNOWN = new Set<string>(SERVER_RULE_CODES);

/** PostgREST sends `details` as text; business rules put JSON in it. */
function parseDetails(details: unknown): Record<string, unknown> {
  let value = details;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/** Reads a PostgREST error body. Unknown `P0001` messages and other codes return null. */
export function parseServerRule(code: unknown, message: unknown, details: unknown): ServerRule | null {
  // Contract §2: business rules are `P0001` + message; iOS matches the message alone.
  if (code !== "P0001" || typeof message !== "string" || !KNOWN.has(message)) return null;
  const ruleCode = message as ServerRuleCode;
  const parsed = parseDetails(details);
  const feature = typeof parsed.feature === "string" ? parsed.feature : null;
  const limit = typeof parsed.limit === "number" && Number.isInteger(parsed.limit) ? parsed.limit : null;
  let upgrade: UpgradeReason | undefined;
  let messageKey: ErrorMessageKey | null;
  if (ruleCode === "PLUS_REQUIRED") {
    upgrade = feature !== null && Object.hasOwn(PLUS_FEATURES, feature) ? PLUS_FEATURES[feature] : "onboarding";
    messageKey = UPGRADE_REASON_KEYS[upgrade];
  } else {
    ({ upgrade, messageKey } = RULES[ruleCode]);
  }
  return {
    code: ruleCode,
    feature,
    limit,
    upgrade: upgrade ? { reason: upgrade, tier: upgrade === "clientViews" ? "pro" : "plus" } : null,
    messageKey,
  };
}
