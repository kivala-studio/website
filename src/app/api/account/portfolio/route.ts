import { readBooks, readCash, readLedger } from "@/data/account/portfolio";
import { ACCOUNT_HEADERS, accountSession, signedOut } from "@/data/account/session";
import { demoBooks, demoCash, demoLedger } from "@/data/demo/portfolio";

/**
 * The account's whole ledger at one revision (contract §5.1), its named portfolios (§5.2) and cash
 * movements (§5.3), amounts as exact decimal strings.
 */
export async function GET(): Promise<Response> {
  const session = await accountSession();
  if (!session) return signedOut();
  try {
    const [ledger, books, cash] =
      session.kind === "demo"
        ? await Promise.all([demoLedger(), demoBooks(), demoCash()])
        : await Promise.all([readLedger(session.client), readBooks(session.client, session.userID), readCash(session.client, session.userID)]);
    return Response.json({ userID: session.userID, ...ledger, books, cash }, { headers: ACCOUNT_HEADERS });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: ACCOUNT_HEADERS });
  }
}
