import { readSubscriptionAccess } from "@/data/account/reads";
import { ACCOUNT_HEADERS, accountSession, signedOut } from "@/data/account/session";
import { demoCurrentAccess } from "@/data/demo/watchlist";

/** The plan access document alone, re-read after a confirmed watchlist change (Free's active ids move). */
export async function GET(): Promise<Response> {
  const session = await accountSession();
  if (!session) return signedOut();
  try {
    const access = session.kind === "demo" ? await demoCurrentAccess(session.account) : await readSubscriptionAccess(session.client);
    return Response.json({ userID: session.userID, access }, { headers: ACCOUNT_HEADERS });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: ACCOUNT_HEADERS });
  }
}
