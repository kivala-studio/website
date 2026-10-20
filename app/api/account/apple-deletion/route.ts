import { NextRequest, NextResponse } from "next/server";
import { appleWebDeletionAvailable } from "../../../../lib/web-feature-config";
import {
  attemptCookie,
  resultCookie,
  cookieOptions,
} from "../../../../lib/apple-deletion-return";

// The existing Apple endpoint has no browser CORS handler. Forward only the
// explicitly confirmed account's bearer, never a service credential.
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const authorization = request.headers.get("authorization");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const base = process.env.SUPABASE_URL;
  if (!authorization?.startsWith("Bearer "))
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  if (
    !key?.startsWith("sb_publishable_") ||
    !base ||
    !appleWebDeletionAvailable()
  ) {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
  try {
    const input = await request.json();
    const browserChallenge = Array.from(
      crypto.getRandomValues(new Uint8Array(32)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    const response = await fetch(
      new URL("/functions/v1/apple-web-deletion/start", base),
      {
        method: "POST",
        headers: {
          authorization,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ returnPlatform: "web", browserChallenge }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      return NextResponse.json(
        { error: "Apple authorization unavailable" },
        { status: response.status },
      );
    const data = await response.json();
    if (
      data.returnPlatform !== "web" ||
      data.receiptVersion !== 1 ||
      data.userID !== input.expectedUserID ||
      !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(data.userID)
    )
      throw new Error("Website return is not configured");
    const target = new URL(data.authorizationURL);
    if (target.protocol !== "https:" || target.hostname !== "appleid.apple.com")
      throw new Error("Invalid redirect");
    const result = NextResponse.json(
      { authorizationURL: target.href },
      { headers: { "Cache-Control": "no-store" } },
    );
    result.cookies.set(
      attemptCookie,
      JSON.stringify({ userID: data.userID, challenge: browserChallenge }),
      cookieOptions,
    );
    result.cookies.set(resultCookie, "", { ...cookieOptions, maxAge: 0 });
    return result;
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 502 });
  }
}
