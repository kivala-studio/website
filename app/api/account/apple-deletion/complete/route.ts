import { NextRequest, NextResponse } from "next/server";
import {
  attemptCookie,
  resultCookie,
  cookieOptions,
  verifyBrowserReturn,
} from "../../../../../lib/apple-deletion-return";
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("receipt") || "";
  const verified = await verifyBrowserReturn(
    process.env.APPLE_WEBSITE_RECEIPT_SECRET || "",
    token,
    request.cookies.get(attemptCookie)?.value,
  );
  const response = NextResponse.redirect(
    new URL(
      `/conta?appleDeletion=${verified ? "verified" : "invalid"}`,
      request.nextUrl.origin,
    ),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (verified) {
    response.cookies.set(attemptCookie, "", { ...cookieOptions, maxAge: 0 });
    response.cookies.set(resultCookie, token, {
      ...cookieOptions,
      maxAge: Math.max(0, verified.expiresAt - Math.floor(Date.now() / 1000)),
    });
  }
  return response;
}
