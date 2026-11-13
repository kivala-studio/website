import { ACCOUNT_HEADERS, accountSession, signedOut } from "@/data/account/session";
import { demoClockFromHeader } from "@/data/demo/clock";
import { readIntelligence, requestedWeek } from "@/features/intelligence/server";

/** One week's verified closes, recent publications and the ledger, for the browser's insight engine. */
export async function GET(request: Request): Promise<Response> {
  const session = await accountSession();
  if (!session) return signedOut();
  const url = new URL(request.url);
  const week = requestedWeek(url.searchParams.get("starts_on"), url.searchParams.get("ends_on"));
  if (!week) return Response.json({ error: "period" }, { status: 400, headers: ACCOUNT_HEADERS });
  const clock = demoClockFromHeader(request.headers.get("cookie"));
  return Response.json(await readIntelligence(session, week, clock ?? Date.now(), clock !== undefined), { headers: ACCOUNT_HEADERS });
}
