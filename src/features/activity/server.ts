import "server-only";

import {
  type ActivityPage,
  readAlertItems,
  readCategoryPreferences,
  readNotificationPage,
  readRecapPreference,
  readUnusualPreferences,
  withArticles,
} from "@/data/account/activity";
import type { AccountSession } from "@/data/account/session";
import { demoWatchlist } from "@/data/demo/account";
import { demoAlertItems, demoNotificationPage, demoNotificationPreferences } from "@/data/demo/activity";
import { type ActivityCursor, hasNewActivity, mergeItems } from "@/domain/activity/activity";
import type { NotificationPreferences } from "@/domain/activity/preferences";

/**
 * One page of the Activity centre. The first page also carries the explicit alerts of the last 28 days (one row
 * per event); later pages continue the notification keyset only.
 */
export async function readActivity(session: AccountSession, cursor: ActivityCursor | null, now: number): Promise<ActivityPage> {
  if (session.kind === "demo") {
    const watchlist = await demoWatchlist();
    const page = await demoNotificationPage(session.account, watchlist, cursor, now);
    return cursor ? page : { ...page, items: mergeItems(page.items, await demoAlertItems(watchlist, now)) };
  }
  const { client, userID } = session;
  const [page, alerts] = await Promise.all([readNotificationPage(client, userID, cursor), cursor ? [] : readAlertItems(client, userID, now)]);
  return { cursor: page.cursor, items: mergeItems(await withArticles(client, page.items), alerts) };
}

/** The bell's first state, by the same rule the page applies; a failure shows no dot. */
export async function hasUnreadActivity(session: AccountSession, now: number): Promise<boolean> {
  try {
    return hasNewActivity((await readActivity(session, null, now)).items, now);
  } catch {
    return false;
  }
}

export async function readNotificationPreferences(session: AccountSession): Promise<NotificationPreferences> {
  if (session.kind === "demo") return demoNotificationPreferences();
  const { client, userID } = session;
  const [categories, recaps, unusual] = await Promise.all([
    readCategoryPreferences(client, userID),
    readRecapPreference(client, userID),
    readUnusualPreferences(client, userID),
  ]);
  return { categories, recaps, unusual };
}
