import { ACCOUNT_HEADERS, accountSession, isUUID, signedOut } from "@/data/account/session";
import { readOrderBook } from "@/data/account/reads";
import { demoOrderBook, demoScenario } from "@/data/demo/account";

/** The latest order book of one instrument; levels beyond the account's depth are withheld by the server. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!isUUID(id)) return Response.json({ error: "not_found" }, { status: 404, headers: ACCOUNT_HEADERS });
  const session = await accountSession();
  if (!session) return signedOut();
  try {
    const book =
      session.kind === "demo" ? demoOrderBook(id, await demoScenario(), Date.now(), session.account.tier) : await readOrderBook(session.client, id);
    return Response.json({ userID: session.userID, book }, { headers: ACCOUNT_HEADERS });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: ACCOUNT_HEADERS });
  }
}
