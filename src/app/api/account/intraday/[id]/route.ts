import { ACCOUNT_HEADERS, accountSession, isUUID, signedOut } from "@/data/account/session";
import { readIntradayChart } from "@/data/account/reads";
import { demoIntraday, demoScenario } from "@/data/demo/account";

/** Today's intraday chart (`get_intraday_chart`); signed-in only, as the backend grants it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!isUUID(id)) return Response.json({ error: "not_found" }, { status: 404, headers: ACCOUNT_HEADERS });
  const session = await accountSession();
  if (!session) return signedOut();
  try {
    const chart = session.kind === "demo" ? demoIntraday(id, await demoScenario(), Date.now()) : await readIntradayChart(session.client, id);
    return Response.json({ userID: session.userID, chart }, { headers: ACCOUNT_HEADERS });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: ACCOUNT_HEADERS });
  }
}
