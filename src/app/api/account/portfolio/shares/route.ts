import { readShares } from "@/data/account/portfolio";
import { ACCOUNT_HEADERS, accountSession, isUUID, signedOut } from "@/data/account/session";
import { demoShares } from "@/data/demo/portfolio";

/** One portfolio's share links (`?portfolio=main` or its id), newest first. Tokens are never readable again. */
export async function GET(request: Request): Promise<Response> {
  const session = await accountSession();
  if (!session) return signedOut();
  const portfolio = new URL(request.url).searchParams.get("portfolio");
  if (portfolio !== "main" && !isUUID(portfolio)) return Response.json({ error: "invalid" }, { status: 400, headers: ACCOUNT_HEADERS });
  const portfolioId = portfolio === "main" ? null : portfolio!.toLowerCase();
  try {
    const shares = session.kind === "demo" ? await demoShares(portfolioId) : await readShares(session.client, session.userID, portfolioId);
    return Response.json({ userID: session.userID, shares }, { headers: ACCOUNT_HEADERS });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: ACCOUNT_HEADERS });
  }
}
