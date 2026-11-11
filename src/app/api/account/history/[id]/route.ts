import { ACCOUNT_HEADERS, accountSession, isUUID, signedOut } from "@/data/account/session";
import { readAccountHistoryRows } from "@/data/account/reads";
import { demoFullHistoryRows } from "@/data/demo/account";
import { encodePoints } from "@/data/market/history-wire";
import { pricePoints } from "@/data/market/history";
import { PUBLIC_HISTORY_DAYS } from "@/data/market/public";
import { DAY_MS } from "@/domain/market/zone";

/**
 * Every daily close the account may read (the `Tudo` range and the CSV export). Row-level security bounds
 * Free to the last year; the demo account applies the same bound.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!isUUID(id)) return Response.json({ error: "not_found" }, { status: 404, headers: ACCOUNT_HEADERS });
  const session = await accountSession();
  if (!session) return signedOut();
  const now = Date.now();
  try {
    let points;
    if (session.kind === "demo") {
      points = pricePoints(demoFullHistoryRows(id));
      if (session.account.tier === "free") points = points.filter((point) => point.date >= now - PUBLIC_HISTORY_DAYS * DAY_MS);
    } else {
      points = pricePoints(await readAccountHistoryRows(session.client, id, now));
    }
    return Response.json({ userID: session.userID, points: encodePoints(points) }, { headers: ACCOUNT_HEADERS });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: ACCOUNT_HEADERS });
  }
}
