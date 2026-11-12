import { type ActivityCursor, type ActivityItem, decodeActivityItem } from "@/domain/activity/activity";
import { type NotificationPreferences, decodeNotificationPreferences } from "@/domain/activity/preferences";
import { DecodingError } from "@/domain/errors";
import { readAccountRoute, settle } from "@/features/account/results";

import { markActivityRead, saveNotificationCategories, saveUnusualActivityPreferences, setMarketRecaps } from "./actions";
import type { ActivityRepository } from "./activity-store";
import type { PreferencesRepository } from "./preferences-store";

function decodeCursor(value: unknown): ActivityCursor | null {
  if (typeof value !== "object" || value === null) return null;
  const { createdAt, id } = value as Record<string, unknown>;
  return typeof createdAt === "string" && typeof id === "string" ? { createdAt, id } : null;
}

/** The Activity centre through `/api/account/activity` and its receipt action, for one signed-in account. */
export function accountActivityRepository(userID: string): ActivityRepository {
  return {
    async read(cursor, signal) {
      const query = cursor ? `?${new URLSearchParams({ before_created_at: cursor.createdAt, before_id: cursor.id })}` : "";
      const body = await readAccountRoute(`/api/account/activity${query}`, userID, signal);
      if (!Array.isArray(body.items)) throw new DecodingError("activity");
      return {
        items: body.items.map(decodeActivityItem).filter((item): item is ActivityItem => item !== null),
        cursor: decodeCursor(body.cursor),
      };
    },
    markRead: async (receipt) => void (await settle(markActivityRead(userID, receipt), "activity.read")),
  };
}

export function accountPreferencesRepository(userID: string): PreferencesRepository {
  return {
    async read(signal): Promise<NotificationPreferences> {
      const body = await readAccountRoute("/api/account/notification-preferences", userID, signal);
      const preferences = decodeNotificationPreferences(body.preferences);
      if (!preferences) throw new DecodingError("preferences");
      return preferences;
    },
    saveCategories: async (value) => void (await settle(saveNotificationCategories(userID, value), "preferences.categories")),
    setRecaps: async (value) => void (await settle(setMarketRecaps(userID, value), "preferences.recaps")),
    saveUnusual: async (value) => void (await settle(saveUnusualActivityPreferences(userID, value), "preferences.unusual")),
  };
}
