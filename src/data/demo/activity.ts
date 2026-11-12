import "server-only";

import { cookies } from "next/headers";

import { demoNewsRows } from "@/data/market/demo/public-demo";
import { recordedSnapshot } from "@/data/market/demo/scenarios";
import {
  ACTIVITY_PAGE_SIZE,
  type ActivityCursor,
  type ActivityItem,
  alertItems,
  decodeAccountNotification,
  decodeAlertDelivery,
  nextCursor,
} from "@/domain/activity/activity";
import {
  type CategoryPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type UnusualPreferences,
  decodeNotificationPreferences,
} from "@/domain/activity/preferences";
import { DAY_MS, civilDate, startOfDay } from "@/domain/market/zone";

import { COOKIE_OPTIONS, type DemoAccount } from "./account";
import { DEMO_COOKIES } from "./tiers";

/*
 * The demo inbox: server-shaped rows relative to the request time, decoded by the same code as production. More rows
 * than one page, so paging is exercised. Read receipts and preferences live in cookies.
 */

const [, , , , , , , READ_COOKIE, PREFERENCES_COOKIE] = DEMO_COOKIES;
const HOUR_MS = 3_600_000;
const id = (index: number) => `a0000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const symbolOf = (securityID: string) => recordedSnapshot.securities.find((security) => security.id === securityID)?.symbol ?? "";
const composition = (title: string, body: string, privacyClass = "public_market") => ({ title, body, accessibilityText: null, privacyClass });

type Row = Record<string, unknown>;

/** Every demo notification, newest first by `created_at` then `id` (the RPC's order). */
function demoRows(account: DemoAccount, watchlist: readonly string[], requestNow: number): Row[] {
  // Times anchored to the hour, so a cursor from one request still names a row in the next.
  const now = Math.floor(requestNow / HOUR_MS) * HOUR_MS;
  const securities = watchlist.length > 0 ? watchlist : recordedSnapshot.securities.slice(0, 3).map((security) => security.id);
  const first = securities[0];
  const second = securities[1 % securities.length];
  const article = demoNewsRows(now)[0] as { id: string; title: string };
  const rows: Row[] = [];
  const add = (index: number, ageMs: number, row: Row) => {
    const at = new Date(now - ageMs).toISOString();
    rows.push({ id: id(index), user_id: account.id, occurred_at: at, created_at: at, content_state: "active", ...row });
  };
  add(1, 1 * HOUR_MS, {
    category: "news_publication",
    article_id: article.id,
    composition: composition("Nova notícia na invest.ao", article.title),
  });
  add(2, 2 * HOUR_MS, {
    category: "asset_movement",
    security_id: first,
    composition: composition(`${symbolOf(first)} está a mexer`, `${symbolOf(first)}: +5,26% face ao último fecho.`),
  });
  add(3, 3 * HOUR_MS, {
    category: "unusual_activity",
    unusual_digest_on: civilDate(now),
    composition: composition("Atividade invulgar", `${symbolOf(second)} teve atividade fora do habitual hoje.`),
  });
  add(4, 4 * HOUR_MS, {
    category: "portfolio_daily",
    composition: composition("A tua carteira ganhou terreno", "Hoje a carteira subiu 1,20% com os preços verificados.", "private_financial"),
  });
  // Yesterday evening in Luanda: the close, a listing and the weekly wrap.
  const yesterday = now - (startOfDay(now) - DAY_MS + 18 * HOUR_MS);
  add(5, yesterday, {
    category: "daily_close",
    close_on: civilDate(now - DAY_MS),
    composition: composition("Fecho da BODIVA", "3 em alta e 2 em baixa. Maior variação: BAIAAAAA +4,50%."),
    facts: { eventFamily: "daily_close", advancers: 3, decliners: 2, unchanged: 2, topSymbol: symbolOf(first), topChangePercent: 4.5, watchedAdvancers: 1, watchedDecliners: 0, watchedCount: 2 },
  });
  add(6, yesterday + HOUR_MS, {
    category: "market_listing",
    security_id: second,
    composition: composition("Novo na BODIVA", `${symbolOf(second)} já está oficialmente em negociação na BODIVA.`),
  });
  add(7, 4 * DAY_MS, { category: "asset_movement", security_id: second, content_state: "withdrawn", composition: composition("Movimento relevante", "") });
  // Older movement history across four weeks: more than one page.
  for (let index = 0; index < 55; index += 1) {
    const security = securities[index % securities.length];
    const change = ((index % 9) + 2).toFixed(2).replace(".", ",");
    add(100 + index, 2 * DAY_MS + index * 10 * HOUR_MS, {
      category: "asset_movement",
      security_id: security,
      composition: composition(`${symbolOf(security)} levou um abanão`, `${symbolOf(security)}: ${index % 2 ? "-" : "+"}${change}% face ao último fecho.`),
    });
  }
  return rows.sort((a, b) => (a.created_at === b.created_at ? String(b.id).localeCompare(String(a.id)) : String(b.created_at).localeCompare(String(a.created_at))));
}

async function readIDs(): Promise<Set<string>> {
  const value = (await cookies()).get(READ_COOKIE)?.value;
  return new Set(value ? value.split(".") : []);
}

/** Rows older than two days start read, so the bell reflects the recent ones. */
const isRead = (row: Row, read: ReadonlySet<string>, now: number) =>
  read.has(String(row.id)) || now - Date.parse(String(row.created_at)) > 2 * DAY_MS;

export async function demoNotificationPage(account: DemoAccount, watchlist: readonly string[], cursor: ActivityCursor | null, now: number) {
  const read = await readIDs();
  const all = demoRows(account, watchlist, now);
  // The RPC's keyset: rows strictly before the cursor's (created_at, id).
  const before = (row: Row) =>
    !cursor || String(row.created_at) < cursor.createdAt || (row.created_at === cursor.createdAt && String(row.id) < cursor.id);
  const rows = all
    .filter(before)
    .slice(0, ACTIVITY_PAGE_SIZE).map((row) => ({ ...row, read_at: isRead(row, read, now) ? row.created_at : null }));
  const slugs = new Map(demoNewsRows(now).map((article) => [String(article.id), String(article.slug)]));
  const items = rows
    .map((row) => decodeAccountNotification(row, account.id))
    .filter((item): item is ActivityItem => item !== null)
    .map((item) => (item.destination.kind === "article" ? { ...item, destination: { ...item.destination, slug: slugs.get(item.destination.articleID) ?? null } } : item));
  return { items, cursor: rows.length < ACTIVITY_PAGE_SIZE ? null : nextCursor(rows) };
}

/** One explicit alert match delivered to two devices: one row in the inbox. */
export async function demoAlertItems(watchlist: readonly string[], now: number): Promise<ActivityItem[]> {
  const security = watchlist[0];
  if (!security) return [];
  const read = await readIDs();
  const at = new Date(now - 30 * 60_000).toISOString();
  const delivery = (deliveryID: string) => ({
    id: deliveryID,
    created_at: at,
    is_read: read.has(deliveryID),
    rule_id: "b0000000-0000-4000-8000-000000000001",
    market_price_id: "b0000000-0000-4000-8000-000000000002",
    market_alert_event_id: null,
    alert_snapshot: { kind: "price_above", threshold: 100000, securities: { id: security, symbol: symbolOf(security) } },
  });
  return alertItems(["d1", "d2"].map((deliveryID) => decodeAlertDelivery(delivery(deliveryID))).filter((row) => row !== null));
}

export async function demoMarkRead(ids: readonly string[]): Promise<void> {
  const read = await readIDs();
  for (const value of ids) read.add(value);
  (await cookies()).set(READ_COOKIE, [...read].slice(-120).join("."), COOKIE_OPTIONS);
}

export async function demoNotificationPreferences(): Promise<NotificationPreferences> {
  const value = (await cookies()).get(PREFERENCES_COOKIE)?.value;
  if (!value) return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    return decodeNotificationPreferences(JSON.parse(value)) ?? DEFAULT_NOTIFICATION_PREFERENCES;
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

async function savePreferences(next: NotificationPreferences): Promise<void> {
  (await cookies()).set(PREFERENCES_COOKIE, JSON.stringify(next), COOKIE_OPTIONS);
}

export const demoSaveCategories = async (categories: CategoryPreferences) => savePreferences({ ...(await demoNotificationPreferences()), categories });
export const demoSaveRecaps = async (recaps: boolean) => savePreferences({ ...(await demoNotificationPreferences()), recaps });
export const demoSaveUnusual = async (unusual: UnusualPreferences) => savePreferences({ ...(await demoNotificationPreferences()), unusual });
