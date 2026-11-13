import type { Insight } from "./models";

/*
 * iOS `IntelligencePrivacyClassification`, `IntelligencePrivacyPolicy` and `Insight.privacyClassification`.
 * Classify information by what it reveals, independently of its generator or screen.
 */

export type IntelligencePrivacyClassification = "publicMarket" | "personalContext" | "privateFinancial";
export type PrivacySurface = "inApp" | "notificationPreview" | "widget" | "wrapShare" | "appSnapshot";

export interface IntelligencePrivacyPolicy {
  readonly surface: PrivacySurface;
  readonly privacyEnabled?: boolean;
  readonly authorizesPersonalContext?: boolean;
  readonly authorizesFinancial?: boolean;
}

/** Consent never overrides active privacy mode. */
export function allows(policy: IntelligencePrivacyPolicy, classification: IntelligencePrivacyClassification): boolean {
  const privacyEnabled = policy.privacyEnabled ?? false;
  switch (policy.surface) {
    case "appSnapshot":
      return false;
    case "notificationPreview":
      return classification === "publicMarket";
    case "inApp":
      return !privacyEnabled || classification === "publicMarket";
    case "widget":
      if (classification === "publicMarket") return true;
      return !privacyEnabled && (classification === "personalContext" || (policy.authorizesFinancial ?? false));
    case "wrapShare":
      if (classification === "publicMarket") return true;
      return !privacyEnabled && (classification === "personalContext" ? (policy.authorizesPersonalContext ?? false) : (policy.authorizesFinancial ?? false));
  }
}

export function privacyClassification(insight: Insight): IntelligencePrivacyClassification {
  const { fact, category, type, relevance } = insight;
  switch (fact.kind) {
    case "portfolioPerformance":
    case "portfolioAllocation":
      return "privateFinancial";
    case "watchlistMovement":
    case "watchlistSessionRun":
    case "watchlistClosingExtreme":
    case "breadth":
      return "personalContext";
    case "watchlistInformation":
      return category === "market" && type === "marketInformation" && !relevance.isHeld && !relevance.isWatched ? "publicMarket" : "personalContext";
    case "priceChange":
      return category !== "market" || relevance.isHeld || relevance.isWatched ? "personalContext" : "publicMarket";
  }
}

/** Personal insights require an explicit privacy decision in their presentation surface. */
export const isPubliclyShareable = (insight: Insight) => privacyClassification(insight) === "publicMarket";
