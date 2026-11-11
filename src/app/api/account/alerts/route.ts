import { readRules } from "@/data/account/rules";
import { ACCOUNT_HEADERS, accountSession, signedOut } from "@/data/account/session";
import { demoWatchlist } from "@/data/demo/account";
import { demoRules } from "@/data/demo/watchlist";
import { encodeAlertRule } from "@/domain/account/alerts";

/** Every alert rule of the account, newest first. */
export async function GET(): Promise<Response> {
  const session = await accountSession();
  if (!session) return signedOut();
  try {
    const rules = session.kind === "demo" ? await demoRules(session.account, await demoWatchlist()) : await readRules(session.client, session.userID);
    return Response.json({ userID: session.userID, rules: rules.map(encodeAlertRule) }, { headers: ACCOUNT_HEADERS });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: ACCOUNT_HEADERS });
  }
}
