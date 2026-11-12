import { ACCOUNT_HEADERS, accountSession, isUUID, signedOut } from "@/data/account/session";
import { requestTime } from "@/data/clock";
import { parseInstant } from "@/domain/market/zone";
import { readActivity } from "@/features/activity/server";

/** A page of the Activity centre: `?before_created_at=&before_id=` continues the keyset (both or neither). */
export async function GET(request: Request): Promise<Response> {
  const session = await accountSession();
  if (!session) return signedOut();
  const params = new URL(request.url).searchParams;
  const createdAt = params.get("before_created_at");
  const id = params.get("before_id");
  if ((createdAt === null) !== (id === null) || (createdAt !== null && (parseInstant(createdAt) === undefined || !isUUID(id)))) {
    return Response.json({ error: "invalid_cursor" }, { status: 400, headers: ACCOUNT_HEADERS });
  }
  try {
    const page = await readActivity(session, createdAt !== null && id !== null ? { createdAt, id } : null, requestTime());
    return Response.json({ userID: session.userID, ...page }, { headers: ACCOUNT_HEADERS });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: ACCOUNT_HEADERS });
  }
}
