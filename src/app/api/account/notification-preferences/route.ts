import { ACCOUNT_HEADERS, accountSession, signedOut } from "@/data/account/session";
import { readNotificationPreferences } from "@/features/activity/server";

/** The notification categories, the market recap opt-in and the unusual-activity switches. */
export async function GET(): Promise<Response> {
  const session = await accountSession();
  if (!session) return signedOut();
  try {
    return Response.json({ userID: session.userID, preferences: await readNotificationPreferences(session) }, { headers: ACCOUNT_HEADERS });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: ACCOUNT_HEADERS });
  }
}
