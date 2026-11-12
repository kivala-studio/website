import { readGroups } from "@/data/account/groups";
import { readSubscriptionAccess } from "@/data/account/reads";
import { readSensitivity } from "@/data/account/rules";
import { ACCOUNT_HEADERS, accountSession, signedOut } from "@/data/account/session";
import { readWatchlistItems } from "@/data/account/watchlist";
import { demoWatchlistDocument } from "@/data/demo/watchlist";
import type { WatchlistDocument } from "@/domain/account/watchlist";

/** `/lista`'s data: rows with their movement flag, groups, plan access and movement sensitivity. */
export async function GET(): Promise<Response> {
  const session = await accountSession();
  if (!session) return signedOut();
  try {
    let document: WatchlistDocument;
    if (session.kind === "demo") document = await demoWatchlistDocument(session.account);
    else {
      const { client, userID } = session;
      const [items, groups, access, sensitivity] = await Promise.all([
        readWatchlistItems(client, userID),
        readGroups(client, userID),
        readSubscriptionAccess(client).catch(() => null),
        readSensitivity(client, userID),
      ]);
      document = { items, groups, access, sensitivity };
    }
    return Response.json({ userID: session.userID, ...document }, { headers: ACCOUNT_HEADERS });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: ACCOUNT_HEADERS });
  }
}
