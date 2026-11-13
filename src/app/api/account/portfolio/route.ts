import { readLedger } from "@/data/account/portfolio";
import { ACCOUNT_HEADERS, accountSession, signedOut } from "@/data/account/session";
import { demoLedger } from "@/data/demo/portfolio";

/** The account's whole ledger at one revision, amounts as exact decimal strings (contract §5.1). */
export async function GET(): Promise<Response> {
  const session = await accountSession();
  if (!session) return signedOut();
  try {
    const ledger = session.kind === "demo" ? await demoLedger() : await readLedger(session.client);
    return Response.json({ userID: session.userID, ...ledger }, { headers: ACCOUNT_HEADERS });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: ACCOUNT_HEADERS });
  }
}
