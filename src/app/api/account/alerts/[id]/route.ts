import { ACCOUNT_HEADERS, accountSession, isUUID, signedOut } from "@/data/account/session";
import { readAlertCounts } from "@/data/account/reads";
import { demoAlerts, demoWatchlist } from "@/data/demo/account";

/** How many of this account's alert rules on one instrument are enabled or paused. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!isUUID(id)) return Response.json({ error: "not_found" }, { status: 404, headers: ACCOUNT_HEADERS });
  const session = await accountSession();
  if (!session) return signedOut();
  try {
    const counts =
      session.kind === "demo" ? demoAlerts(session.account, await demoWatchlist(), id) : await readAlertCounts(session.client, session.userID, id);
    return Response.json({ userID: session.userID, ...counts }, { headers: ACCOUNT_HEADERS });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: ACCOUNT_HEADERS });
  }
}
