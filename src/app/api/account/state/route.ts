import { ACCOUNT_HEADERS, accountSession, signedOut } from "@/data/account/session";
import { readAccountState } from "@/features/account/state";

/** The signed-in account's watchlist and plan access (refreshed when the tab returns). */
export async function GET(): Promise<Response> {
  const session = await accountSession();
  if (!session) return signedOut();
  const { userID, watchlist, access, watchlistFailed } = await readAccountState(session);
  if (watchlistFailed) return Response.json({ error: "unavailable" }, { status: 503, headers: ACCOUNT_HEADERS });
  return Response.json({ userID, watchlist, access }, { headers: ACCOUNT_HEADERS });
}
