import Decimal from "decimal.js";

import { isAlertKind, isValidThreshold } from "../account/alerts";
import { publicationWindow } from "../news/article";
import { DAY_MS, type EpochMs, civilDate, parseInstant, startOfDay } from "../market/zone";

/*
 * The Activity centre (iOS `ActivityPolicy`, `ActivityCategory`, `ActivityPresentation`): server-composed
 * account notifications and explicit alert deliveries, one row per event. Everything here is JSON-safe so a
 * route can hand items to the browser. Local insights (W14) join through `src/domain/intelligence/activity.ts`; the
 * Weekly Wrap card (W15) is not part of it.
 */

/** The server keeps 28 days; nothing older is requested or shown. */
export const ACTIVITY_WINDOW_MS = 28 * DAY_MS;
/** `get_account_notifications` page size (the server clamps 1..100). */
export const ACTIVITY_PAGE_SIZE = 50;
/** `acknowledge_account_notifications` takes at most 100 ids per call. */
export const ACKNOWLEDGE_LIMIT = 100;

export const ACTIVITY_CATEGORIES = ["news", "movements", "portfolio", "watchlist"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];
export type ActivityFilter = "movements" | "news";
export type PrivacyClass = "public_market" | "personal_context" | "private_financial";

export type ActivityDestination =
  | { readonly kind: "instrument"; readonly securityID: string }
  | { readonly kind: "article"; readonly articleID: string; readonly slug: string | null }
  | { readonly kind: "wrap"; readonly period: string }
  | { readonly kind: "portfolio" }
  /** A local watchlist reading (W14); its rows open the watchlist. */
  | { readonly kind: "watchlist" }
  | { readonly kind: "unusualDigest" }
  | { readonly kind: "none" };

export interface DailyCloseFacts {
  readonly advancers: number;
  readonly decliners: number;
  readonly topSymbol: string | null;
  /** Decimal string. */
  readonly topChangePercent: string | null;
  readonly watchedAdvancers: number | null;
  readonly watchedDecliners: number | null;
  readonly watchedCount: number | null;
}

/** What a row says. Alert thresholds never reach this shape. */
export type ActivityCopy =
  | { readonly kind: "composition"; readonly title: string; readonly body: string; readonly accessibilityText: string | null }
  | { readonly kind: "dailyClose"; readonly facts: DailyCloseFacts }
  | { readonly kind: "alert"; readonly symbol: string | null }
  | { readonly kind: "unavailable" };

export interface ActivityItem {
  /** `account:<uuid>` or `alert:<event identity>`. */
  readonly id: string;
  readonly occurredAt: EpochMs;
  readonly category: ActivityCategory;
  readonly destination: ActivityDestination;
  /** Tie-break inside one instant: notifications and alerts 0. */
  readonly priority: number;
  readonly read: boolean;
  readonly privacy: PrivacyClass;
  /** News, recaps and market updates show only today and yesterday (Luanda). */
  readonly newsWindow: boolean;
  readonly copy: ActivityCopy;
  /** `account_notifications` ids to acknowledge. */
  readonly notificationIDs: readonly string[];
  /** `notification_deliveries` ids to mark read: every device's copy of the event. */
  readonly deliveryIDs: readonly string[];
}

/** The keyset of the next `get_account_notifications` page: the last row's `created_at` and `id` together. */
export interface ActivityCursor {
  readonly createdAt: string;
  readonly id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CIVIL = /^\d{4}-\d{2}-\d{2}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value : null);
const uuid = (value: unknown) => (typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null);
const whole = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null);
const PRIVACY: readonly PrivacyClass[] = ["public_market", "personal_context", "private_financial"];

const CATEGORIES = [
  "asset_movement",
  "market_listing",
  "market_recap",
  "portfolio_daily",
  "news_publication",
  "weekly_wrap",
  "unusual_activity",
  "daily_close",
] as const;
type ServerCategory = (typeof CATEGORIES)[number];
const isServerCategory = (value: unknown): value is ServerCategory => (CATEGORIES as readonly unknown[]).includes(value);

/** Daily close facts as the server stores them (`facts`); a malformed set falls back to the composition. */
export function decodeDailyCloseFacts(value: unknown): DailyCloseFacts | null {
  if (!isRecord(value)) return null;
  const advancers = whole(value.advancers);
  const decliners = whole(value.decliners);
  if (advancers === null || decliners === null) return null;
  const change = value.topChangePercent;
  const decimal = typeof change === "number" || typeof change === "string" ? new Decimal(change) : null;
  const symbol = text(value.topSymbol);
  return {
    advancers,
    decliners,
    topSymbol: symbol && decimal?.isFinite() ? symbol : null,
    topChangePercent: symbol && decimal?.isFinite() ? decimal.toString() : null,
    watchedAdvancers: whole(value.watchedAdvancers),
    watchedDecliners: whole(value.watchedDecliners),
    watchedCount: whole(value.watchedCount),
  };
}

/** Where a category opens (contract §4.4). Null: the routing id is missing, so the row is not shown. */
function destinationOf(category: ServerCategory, row: Record<string, unknown>): ActivityDestination | null {
  const security = uuid(row.security_id);
  const article = uuid(row.article_id);
  switch (category) {
    case "asset_movement":
    case "market_listing":
      return security ? { kind: "instrument", securityID: security } : null;
    case "unusual_activity":
      if (security) return { kind: "instrument", securityID: security };
      return typeof row.unusual_digest_on === "string" ? { kind: "unusualDigest" } : null;
    case "market_recap":
    case "news_publication":
      return article ? { kind: "article", articleID: article, slug: null } : null;
    case "weekly_wrap":
      return typeof row.wrap_starts_on === "string" && CIVIL.test(row.wrap_starts_on) ? { kind: "wrap", period: `weekly-${row.wrap_starts_on}` } : null;
    case "portfolio_daily":
      return { kind: "portfolio" };
    case "daily_close":
      // The close summary is the information itself; there is nothing further to open.
      return { kind: "none" };
  }
}

/** Price moves belong under Movimentos; everything editorial under Notícias. */
function categoryOf(category: ServerCategory): ActivityCategory {
  switch (category) {
    case "asset_movement":
    case "unusual_activity":
      return "movements";
    case "portfolio_daily":
      return "portfolio";
    default:
      return "news";
  }
}

/** One `get_account_notifications` row. Rows without a composition, from another account or unroutable are dropped. */
export function decodeAccountNotification(row: unknown, expectedUserID: string): ActivityItem | null {
  if (!isRecord(row)) return null;
  const id = uuid(row.id);
  const category = row.category;
  const occurredAt = parseInstant(typeof row.occurred_at === "string" ? row.occurred_at : undefined);
  if (!id || uuid(row.user_id) !== expectedUserID.toLowerCase() || !isServerCategory(category) || occurredAt === undefined) return null;
  const composition = row.composition;
  if (!isRecord(composition)) return null;
  const title = text(composition.title);
  const body = typeof composition.body === "string" ? composition.body : null;
  if (title === null || body === null) return null;
  const destination = destinationOf(category, row);
  if (!destination) return null;
  const available = row.content_state === "active";
  const facts = category === "daily_close" ? decodeDailyCloseFacts(row.facts) : null;
  return {
    id: `account:${id}`,
    occurredAt,
    category: categoryOf(category),
    destination: available ? destination : { kind: "none" },
    priority: 0,
    read: typeof row.read_at === "string",
    privacy: PRIVACY.find((value) => value === composition.privacyClass) ?? "private_financial",
    newsWindow: categoryOf(category) === "news",
    copy: !available
      ? { kind: "unavailable" }
      : facts
        ? { kind: "dailyClose", facts }
        : { kind: "composition", title, body, accessibilityText: text(composition.accessibilityText) },
    notificationIDs: [id],
    deliveryIDs: [],
  };
}

/** The cursor for the page after `rows` (raw RPC rows, in server order). */
export function nextCursor(rows: readonly unknown[]): ActivityCursor | null {
  const last = rows.at(-1);
  if (!isRecord(last) || typeof last.created_at !== "string" || !uuid(last.id)) return null;
  return { createdAt: last.created_at, id: String(last.id) };
}

/** One device's copy of an explicit alert (`notification_deliveries`, `delivery_kind = 'alert_rule'`). */
export interface AlertDelivery {
  readonly deliveryID: string;
  /** The event: every device's delivery of one rule match shares it. */
  readonly identity: string;
  readonly occurredAt: EpochMs;
  readonly read: boolean;
  readonly securityID: string;
  readonly symbol: string | null;
}

function ruleReference(value: unknown): { securityID: string; symbol: string | null } | null {
  if (!isRecord(value) || !isAlertKind(value.kind)) return null;
  const threshold = typeof value.threshold === "number" || typeof value.threshold === "string" ? new Decimal(value.threshold) : null;
  if (!threshold || !threshold.isFinite() || !isValidThreshold(threshold)) return null;
  const security = isRecord(value.securities) ? value.securities : null;
  const securityID = uuid(security?.id);
  return securityID ? { securityID, symbol: text(security?.symbol) } : null;
}

/**
 * An alert delivery row. The frozen `alert_snapshot` wins over today's (possibly edited) rule; a malformed snapshot
 * is not replaced by the current rule. The threshold is validated, never carried.
 */
export function decodeAlertDelivery(row: unknown): AlertDelivery | null {
  if (!isRecord(row) || typeof row.id !== "string" || row.id === "") return null;
  const occurredAt = parseInstant(typeof row.created_at === "string" ? row.created_at : undefined);
  if (occurredAt === undefined) return null;
  const hasSnapshot = row.alert_snapshot !== null && row.alert_snapshot !== undefined;
  const rule = hasSnapshot ? ruleReference(row.alert_snapshot) : ruleReference(row.notification_rules);
  if (!rule) return null;
  const event = typeof row.market_alert_event_id === "string" ? row.market_alert_event_id.toLowerCase() : null;
  const ruleID = typeof row.rule_id === "string" ? row.rule_id.toLowerCase() : null;
  const priceID = typeof row.market_price_id === "string" ? row.market_price_id.toLowerCase() : null;
  const identity = event ? `alert_rule:event:${event}` : ruleID && priceID ? `rule:${ruleID}:price:${priceID}` : `delivery:${row.id}`;
  return { deliveryID: row.id, identity, occurredAt, read: row.is_read === true, ...rule };
}

/** One row per alert event: the first delivery's time, read once any device's copy was read. */
export function alertItems(deliveries: readonly AlertDelivery[]): ActivityItem[] {
  const events = new Map<string, AlertDelivery[]>();
  for (const delivery of deliveries) events.set(delivery.identity, [...(events.get(delivery.identity) ?? []), delivery]);
  return [...events.entries()].map(([identity, copies]) => {
    const first = copies.reduce((a, b) => (b.occurredAt < a.occurredAt ? b : a));
    return {
      id: `alert:${identity}`,
      occurredAt: first.occurredAt,
      category: "movements",
      destination: { kind: "instrument", securityID: first.securityID },
      priority: 0,
      read: copies.some((copy) => copy.read),
      privacy: "private_financial",
      newsWindow: false,
      copy: { kind: "alert", symbol: first.symbol },
      notificationIDs: [],
      deliveryIDs: copies.map((copy) => copy.deliveryID),
    };
  });
}

/** Inside the 28-day window and not in the future; news rows only for today and yesterday. */
export function isVisible(item: ActivityItem, now: EpochMs): boolean {
  if (!(item.occurredAt <= now) || now - item.occurredAt >= ACTIVITY_WINDOW_MS) return false;
  return !item.newsWindow || item.occurredAt >= publicationWindow(now).start;
}

/** Newest first; then priority, then id (deterministic). */
export function compareItems(a: ActivityItem, b: ActivityItem): number {
  if (a.occurredAt !== b.occurredAt) return b.occurredAt - a.occurredAt;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * A fresher read wins for the ids it carries; rows only an older page holds are kept. A row read here stays read:
 * there is no "mark unread".
 */
export function mergeItems(current: readonly ActivityItem[], incoming: readonly ActivityItem[]): ActivityItem[] {
  const byID = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    const previous = byID.get(item.id);
    byID.set(item.id, previous?.read && !item.read ? { ...item, read: true } : item);
  }
  return [...byID.values()].sort(compareItems);
}

export const filterOf = (category: ActivityCategory): ActivityFilter => (category === "news" ? "news" : "movements");

/** The bell's dot: an unread visible row from today or the previous six Luanda days. */
export function hasNewActivity(items: readonly ActivityItem[], now: EpochMs): boolean {
  const cutoff = startOfDay(now) - 6 * DAY_MS;
  return items.some((item) => !item.read && item.occurredAt >= cutoff && isVisible(item, now));
}

export interface ActivityDay {
  /** Luanda civil date. */
  readonly date: string;
  readonly groups: readonly { readonly category: ActivityCategory; readonly items: readonly ActivityItem[] }[];
}

/** Day sections, newest first; inside a day the categories in fixed order News → Movements → Portfolio → Watchlist. */
export function activityDays(items: readonly ActivityItem[], filter: ActivityFilter, now: EpochMs): ActivityDay[] {
  const days = new Map<string, ActivityItem[]>();
  for (const item of [...items].sort(compareItems)) {
    if (filterOf(item.category) !== filter || !isVisible(item, now)) continue;
    const date = civilDate(item.occurredAt);
    days.set(date, [...(days.get(date) ?? []), item]);
  }
  return [...days.entries()].map(([date, rows]) => ({
    date,
    groups: ACTIVITY_CATEGORIES.map((category) => ({ category, items: rows.filter((item) => item.category === category) })).filter(
      (group) => group.items.length > 0,
    ),
  }));
}

/**
 * Privacy mode (W10): every row that is not public market information shows a generic title and the hidden-content
 * line. Unavailable rows already say nothing personal.
 */
export const isMasked = (item: ActivityItem, privacyMode: boolean) => privacyMode && item.copy.kind !== "unavailable" && item.privacy !== "public_market";

const DESTINATIONS = ["instrument", "article", "wrap", "portfolio", "watchlist", "unusualDigest", "none"];

/** The browser's check of a route's items: anything malformed is dropped. */
export function decodeActivityItem(value: unknown): ActivityItem | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.occurredAt !== "number" || !Number.isFinite(value.occurredAt)) return null;
  if (!(ACTIVITY_CATEGORIES as readonly unknown[]).includes(value.category) || !PRIVACY.includes(value.privacy as PrivacyClass)) return null;
  const destination = value.destination;
  const copy = value.copy;
  if (!isRecord(destination) || !DESTINATIONS.includes(destination.kind as string) || !isRecord(copy)) return null;
  const ids = (list: unknown) => (Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : []);
  return {
    id: value.id,
    occurredAt: value.occurredAt,
    category: value.category as ActivityCategory,
    destination: destination as unknown as ActivityDestination,
    priority: typeof value.priority === "number" ? value.priority : 0,
    read: value.read === true,
    privacy: value.privacy as PrivacyClass,
    newsWindow: value.newsWindow === true,
    copy: copy as unknown as ActivityCopy,
    notificationIDs: ids(value.notificationIDs),
    deliveryIDs: ids(value.deliveryIDs),
  };
}
