"use server";

import {
  acknowledgeNotifications,
  markDeliveriesRead,
  saveCategoryPreferences,
  saveUnusualPreferences,
  setRecapPreference,
} from "@/data/account/activity";
import { isUUID } from "@/data/account/session";
import { demoMarkRead, demoSaveCategories, demoSaveRecaps, demoSaveUnusual } from "@/data/demo/activity";
import { ACKNOWLEDGE_LIMIT } from "@/domain/activity/activity";
import {
  CATEGORY_PREFERENCES,
  type CategoryPreferences,
  type UnusualPreferences,
  decodeCategoryPreferences,
  isUnusualRule,
  normalizedRules,
} from "@/domain/activity/preferences";
import { type AccountResult, accountWrite, invalidArgument } from "@/features/account/write";

const DELIVERY_LIMIT = 200;

/**
 * Marks notifications and alert deliveries read; `opened` also stamps `opened_at` (the row was opened). The
 * caller sends at most 100 notification ids per call, the RPC's limit.
 */
export async function markActivityRead(
  expectedUserID: string,
  receipt: { notificationIDs: string[]; deliveryIDs: string[]; opened: boolean },
): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, "activity.read", async (session) => {
    const notifications = Array.isArray(receipt?.notificationIDs) ? receipt.notificationIDs : [];
    const deliveries = Array.isArray(receipt?.deliveryIDs) ? receipt.deliveryIDs : [];
    if (notifications.length > ACKNOWLEDGE_LIMIT || !notifications.every(isUUID)) throw invalidArgument();
    if (deliveries.length > DELIVERY_LIMIT || !deliveries.every((id) => typeof id === "string" && id.length > 0 && id.length <= 64)) throw invalidArgument();
    if (session.kind === "demo") {
      await demoMarkRead([...notifications, ...deliveries]);
      return null;
    }
    await Promise.all([
      notifications.length > 0 ? acknowledgeNotifications(session.client, notifications, receipt.opened === true) : null,
      deliveries.length > 0 ? markDeliveriesRead(session.client, session.userID, deliveries) : null,
    ]);
    return null;
  });
}

export async function saveNotificationCategories(expectedUserID: string, categories: CategoryPreferences): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, "preferences.categories", async (session) => {
    if (typeof categories !== "object" || categories === null || !CATEGORY_PREFERENCES.every((key) => typeof categories[key] === "boolean")) throw invalidArgument();
    const value = decodeCategoryPreferences(categories);
    if (session.kind === "demo") await demoSaveCategories(value);
    else await saveCategoryPreferences(session.client, session.userID, value);
    return null;
  });
}

export async function setMarketRecaps(expectedUserID: string, enabled: boolean): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, "preferences.recaps", async (session) => {
    if (typeof enabled !== "boolean") throw invalidArgument();
    if (session.kind === "demo") await demoSaveRecaps(enabled);
    else await setRecapPreference(session.client, enabled);
    return null;
  });
}

export async function saveUnusualActivityPreferences(expectedUserID: string, preferences: UnusualPreferences): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, "preferences.unusual", async (session) => {
    const rules = preferences?.disabledRules;
    if (typeof preferences?.enabled !== "boolean" || !Array.isArray(rules) || !rules.every(isUnusualRule)) throw invalidArgument();
    const value = { enabled: preferences.enabled, disabledRules: normalizedRules(rules) };
    if (session.kind === "demo") await demoSaveUnusual(value);
    else await saveUnusualPreferences(session.client, session.userID, value);
    return null;
  });
}
