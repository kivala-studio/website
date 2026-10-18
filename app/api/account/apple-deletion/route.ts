import { NextRequest, NextResponse } from "next/server";

// The existing Apple endpoint has no browser CORS handler. Forward only the
// explicitly confirmed account's bearer, never a service credential.
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const authorization = request.headers.get("authorization");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const base = process.env.SUPABASE_URL;
  if (
    !authorization?.startsWith("Bearer ") ||
    !key?.startsWith("sb_publishable_") ||
    !base
  ) {
    return NextResponse.json({ error: "Unavailable" }, { status: 401 });
  }
  try {
    const response = await fetch(
      new URL("/functions/v1/apple-web-deletion/start", base),
      {
        method: "POST",
        headers: {
          authorization,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ returnPlatform: "web" }),
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
    if (data.returnPlatform !== "web")
      throw new Error("Website return is not configured");
    const target = new URL(data.authorizationURL);
    if (target.protocol !== "https:" || target.hostname !== "appleid.apple.com")
      throw new Error("Invalid redirect");
    return NextResponse.json(
      { authorizationURL: target.href },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 502 });
  }
}
