import type { Messages } from "next-intl";

import { ERROR_MESSAGE_KEYS } from "@/domain/errors";

/**
 * Namespaces that client components read. Only these are serialised into every page; the whole catalogue
 * (~120 kB) would otherwise ride along in each HTML response and delay the first paint on mobile.
 * Server components can use any namespace. Add a namespace here when a client component starts using it.
 */
export const CLIENT_NAMESPACES = ["common", "components", "designSystem", "errors", "formatting", "market", "site"] as const;

/** Single keys from larger namespaces: the shared formatter's bands and days, and every error the presenter can show. */
export const FORMAT_MESSAGE_KEYS = [
  "legacy.entre0E",
  "legacy.entreE0",
  "notifications.date.today",
  "notifications.date.yesterday",
] as const;

export const CLIENT_KEYS: readonly string[] = [...FORMAT_MESSAGE_KEYS, ...ERROR_MESSAGE_KEYS];

/**
 * Extra keys (leaves or whole subtrees) that the client components of one area read. The area's layout adds
 * them with `<ScopedMessages>`, so they ride along only on the pages that need them.
 */
export const AREA_KEYS = {
  market: [
    "markets",
    "assetDetails.accessibility.priceHistory",
    "assetDetails.chart.notEnoughData",
    "assetDetails.history.header",
    "assetDetails.marketInfo",
    "assetDetails.statistics",
    "assetDetails.tab",
    "assetDetails.bondFacts",
    "bondYield",
    "home.movers",
    "legacy.titulo",
    "legacy.titulos",
    "news.information.categoryLabel",
  ],
  /** Every signed-in page (the app shell): search, Home, the instrument's account panels and plan reasons. */
  app: [
    "search",
    "home",
    "assetDetails",
    "liquidity",
    "orderBook",
    "legacy.nivel",
    "legacy.niveis",
    "legacy.ordem",
    "legacy.ordens",
    "markets.category",
    "markets.sort.volume",
    "market.index",
    "subscriptions.paywall",
    "subscriptions.management.plusTitle",
    "subscriptions.management.proTitle",
    "simulation.entry.prompt",
    "watchlist.accessibility",
    "watchlist.addSheet",
    "watchlist.emptyState",
    "watchlist.freePlan",
    "watchlist.groups",
    "watchlist.row",
    "watchlist.undo",
    "alerts",
    "subscriptions.freeSelection",
    "settings.sensitivity",
    "notifications",
    "intelligence.activity",
    "intelligence.priceAlert",
    "notification.close",
    "settings.categories",
    "settings.marketRecap.toggle",
    "settings.deleteAccount",
    "settings.marketData",
    "unusualActivity.title",
    "unusualActivity.settings",
    "legacy.unusualactivityRuleDormancyBreak",
    "legacy.unusualactivityRuleLargeOrder",
    "legacy.unusualactivityRuleLargeTrade",
    "legacy.unusualactivityRulePriceMove",
    "legacy.unusualactivityRuleSpreadChange",
    "legacy.unusualactivityRuleTradeCountSpike",
    "legacy.unusualactivityRuleVolumeSpike",
    "portfolio.accessibility",
    "portfolio.allocation",
    "portfolio.allocationRow",
    "portfolio.csvTransfer",
    "portfolio.dashboard",
    "portfolio.discardConfirmation",
    "portfolio.editor",
    "portfolio.emptyState",
    "portfolio.error",
    "portfolio.form",
    "portfolio.header",
    "portfolio.holdingRow",
    "portfolio.metrics",
    "portfolio.performance",
    "portfolio.picker",
    "portfolio.positionContent",
    "portfolio.positionDetail",
    "portfolio.privateTrend",
    "portfolio.purchaseRow",
    "portfolio.results",
    "portfolio.summary",
    "portfolio.validation",
    "legacy.unidades",
    "legacy.emCustos",
    "income.title",
  ],
  news: ["news.feed", "news.kind", "news.publications", "news.row", "news.store"],
  learn: ["learn.read"],
  share: ["portfolio.summary"],
  auth: ["authentication.signIn"],
  setup: [
    "onboarding.accessibility",
    "onboarding.button",
    "onboarding.emptyState",
    "onboarding.error",
    "onboarding.form",
    "onboarding.selection",
    "onboarding.signOut",
    "onboarding.step",
    "markets.category.treasury",
    "news.information.categoryLabel",
  ],
} as const satisfies Record<string, readonly string[]>;

type Tree = { [key: string]: string | Tree };

function setPath(target: Tree, path: string[], value: string | Tree) {
  let node = target;
  for (const segment of path.slice(0, -1)) {
    const next = node[segment];
    node = typeof next === "object" ? next : (node[segment] = {});
  }
  node[path[path.length - 1]] = value;
}

/** The given keys (leaves or subtrees) of a catalogue, in the catalogue's shape. */
export function pickMessages(messages: Messages, keys: readonly string[], skip: readonly string[] = []): Partial<Messages> {
  const source = messages as unknown as Tree;
  const picked: Tree = {};
  for (const key of keys) {
    const path = key.split(".");
    if (skip.includes(path[0])) continue;
    let value: string | Tree | undefined = source;
    for (const segment of path) value = typeof value === "object" ? value[segment] : undefined;
    if (value !== undefined) setPath(picked, path, value);
  }
  return picked as Partial<Messages>;
}

export function pickClientMessages(messages: Messages): Partial<Messages> {
  const source = messages as unknown as Tree;
  const picked = pickMessages(messages, CLIENT_KEYS, CLIENT_NAMESPACES) as unknown as Tree;
  for (const namespace of CLIENT_NAMESPACES) if (source[namespace]) picked[namespace] = source[namespace];
  return picked as Partial<Messages>;
}
