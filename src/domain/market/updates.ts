import { visibleOutsideSearch } from "./classification";
import type { MarketSecurity } from "./models";
import type { EpochMs } from "./zone";

/** A market information item (iOS `MarketUpdate`). The shared snapshot carries none yet. */
export const MARKET_UPDATE_CATEGORIES = ["bodiva", "issuers", "market", "notices"] as const;
export type MarketUpdateCategory = (typeof MARKET_UPDATE_CATEGORIES)[number];

export interface MarketUpdate {
  readonly id: string;
  readonly category: MarketUpdateCategory;
  readonly title: string;
  readonly detail: string;
  readonly timestamp: EpochMs;
  readonly source: string;
  readonly relatedSecurityIDs: readonly string[];
  readonly body: readonly string[];
}

/** Updates of one category (or all), newest first. */
export function marketUpdates(updates: readonly MarketUpdate[], category?: MarketUpdateCategory): MarketUpdate[] {
  return updates.filter((update) => category === undefined || update.category === category).sort((a, b) => b.timestamp - a.timestamp);
}

/** Visible securities in the update's order; unknown or hidden ids are skipped. */
export function relatedSecurities(update: MarketUpdate, securities: readonly MarketSecurity[], now: EpochMs): MarketSecurity[] {
  const visible = new Map<string, MarketSecurity>();
  for (const security of visibleOutsideSearch(securities, now)) if (!visible.has(security.id)) visible.set(security.id, security);
  return update.relatedSecurityIDs.flatMap((id) => visible.get(id) ?? []);
}
