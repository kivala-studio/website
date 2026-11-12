import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ACTIVITY_PAGE_SIZE,
  ACTIVITY_WINDOW_MS,
  type ActivityCursor,
  type ActivityItem,
  alertItems,
  decodeAccountNotification,
  decodeAlertDelivery,
  nextCursor,
} from "@/domain/activity/activity";
import {
  type CategoryPreferences,
  type UnusualPreferences,
  decodeCategoryPreferences,
  decodeUnusualPreferences,
} from "@/domain/activity/preferences";

import { unwrap } from "../supabase/read";

export interface ActivityPage {
  readonly items: ActivityItem[];
  /** Null on the last page. */
  readonly cursor: ActivityCursor | null;
}

/** One keyset page of `get_account_notifications` (newest first, the server's 28 days). Never an offset. */
export async function readNotificationPage(client: SupabaseClient, userID: string, cursor: ActivityCursor | null): Promise<ActivityPage> {
  const { data, error, status } = await client.rpc("get_account_notifications", {
    page_size: ACTIVITY_PAGE_SIZE,
    before_created_at: cursor?.createdAt ?? null,
    before_id: cursor?.id ?? null,
  });
  const rows = (unwrap({ data, error, status }) ?? []) as unknown[];
  return {
    items: rows.map((row) => decodeAccountNotification(row, userID)).filter((item): item is ActivityItem => item !== null),
    cursor: rows.length < ACTIVITY_PAGE_SIZE ? null : nextCursor(rows),
  };
}

const DELIVERY_COLUMNS =
  "id,created_at,is_read,rule_id,market_price_id,market_alert_event_id,alert_snapshot,notification_rules(kind,threshold,securities(id,symbol))";

/**
 * Explicit alert matches of the last 28 days (`notification_deliveries` keeps one row per device), merged into one
 * row per event. The newest 200 deliveries, as on iOS.
 */
export async function readAlertItems(client: SupabaseClient, userID: string, now: number): Promise<ActivityItem[]> {
  const rows = unwrap(
    await client
      .from("notification_deliveries")
      .select(DELIVERY_COLUMNS)
      .eq("user_id", userID)
      .eq("delivery_kind", "alert_rule")
      .gte("created_at", new Date(now - ACTIVITY_WINDOW_MS).toISOString())
      .order("created_at", { ascending: false })
      .order("id")
      .limit(200),
  ) as unknown[];
  return alertItems(rows.map(decodeAlertDelivery).filter((row) => row !== null));
}

/**
 * Article rows open by slug. A published article fills it in; one the server answers for but no longer publishes
 * hides its row; a failed lookup keeps the row (it shows the unavailable destination when opened).
 */
export async function withArticles(client: SupabaseClient, items: readonly ActivityItem[]): Promise<ActivityItem[]> {
  const ids = [...new Set(items.flatMap((item) => (item.destination.kind === "article" ? [item.destination.articleID] : [])))];
  if (ids.length === 0) return [...items];
  const { data, error } = await client.from("news_articles").select("id,slug").eq("status", "published").in("id", ids);
  if (error || !Array.isArray(data)) return [...items];
  const slugs = new Map((data as { id: string; slug: string }[]).map((row) => [row.id.toLowerCase(), row.slug]));
  return items.flatMap((item) => {
    if (item.destination.kind !== "article") return [item];
    const slug = slugs.get(item.destination.articleID);
    return slug ? [{ ...item, destination: { ...item.destination, slug } }] : [];
  });
}

/** Sets `read_at` (and `opened_at` when opened) for up to 100 rows; also marks linked receipts read on the server. */
export async function acknowledgeNotifications(client: SupabaseClient, ids: readonly string[], opened: boolean): Promise<void> {
  const { error, status } = await client.rpc("acknowledge_account_notifications", { notification_ids: ids, opened });
  unwrap({ data: null, error, status });
}

/** `notification_deliveries.is_read` is the only column the owner may update. */
export async function markDeliveriesRead(client: SupabaseClient, userID: string, ids: readonly string[]): Promise<void> {
  unwrap(await client.from("notification_deliveries").update({ is_read: true }).eq("user_id", userID).in("id", ids));
}

export async function readCategoryPreferences(client: SupabaseClient, userID: string): Promise<CategoryPreferences> {
  const rows = unwrap(await client.from("notification_preferences").select("*").eq("user_id", userID).limit(1)) as unknown[];
  return decodeCategoryPreferences(rows[0]);
}

/** Upserts the whole row, as the apps do. */
export async function saveCategoryPreferences(client: SupabaseClient, userID: string, preferences: CategoryPreferences): Promise<void> {
  unwrap(await client.from("notification_preferences").upsert({ user_id: userID, ...preferences }, { onConflict: "user_id" }));
}

/** `user_recap_preferences.enabled`; no row means off. */
export async function readRecapPreference(client: SupabaseClient, userID: string): Promise<boolean> {
  const rows = unwrap(await client.from("user_recap_preferences").select("enabled").eq("user_id", userID).limit(1)) as { enabled: unknown }[];
  return rows[0]?.enabled === true;
}

/** The recap preference is written only through its RPC. */
export async function setRecapPreference(client: SupabaseClient, enabled: boolean): Promise<void> {
  const { error, status } = await client.rpc("set_market_recap_preference", { wants_recaps: enabled });
  unwrap({ data: null, error, status });
}

export async function readUnusualPreferences(client: SupabaseClient, userID: string): Promise<UnusualPreferences> {
  const rows = unwrap(
    await client.from("unusual_activity_preferences").select("notifications_enabled,disabled_rules").eq("user_id", userID).limit(1),
  ) as unknown[];
  return decodeUnusualPreferences(rows[0]);
}

export async function saveUnusualPreferences(client: SupabaseClient, userID: string, preferences: UnusualPreferences): Promise<void> {
  unwrap(
    await client
      .from("unusual_activity_preferences")
      .upsert({ user_id: userID, notifications_enabled: preferences.enabled, disabled_rules: preferences.disabledRules }, { onConflict: "user_id" }),
  );
}
