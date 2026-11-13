import { ACCOUNT_HEADERS, accountSession, signedOut } from "@/data/account/session";
import { requestTime } from "@/data/clock";
import { demoClockFromHeader } from "@/data/demo/clock";
import { readWeekAhead } from "@/features/week-ahead/server";

/** The coming week's sourced dates for this account; a source failure is 503 (the page may replay a kept batch). */
export async function GET(request: Request): Promise<Response> {
  const session = await accountSession();
  if (!session) return signedOut();
  const clock = demoClockFromHeader(request.headers.get("cookie"));
  try {
    return Response.json(
      { userID: session.userID, ...(await readWeekAhead(session, clock ?? requestTime(), clock !== undefined)) },
      { headers: ACCOUNT_HEADERS },
    );
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: ACCOUNT_HEADERS });
  }
}
