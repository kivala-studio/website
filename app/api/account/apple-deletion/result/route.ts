import { NextRequest, NextResponse } from "next/server";
import { verifyDeletionReceipt } from "../../../../../lib/apple-deletion-receipt";
import {
  resultCookie,
  cookieOptions,
} from "../../../../../lib/apple-deletion-return";
export async function GET(request: NextRequest) {
  const receipt = await verifyDeletionReceipt(
    process.env.APPLE_WEBSITE_RECEIPT_SECRET || "",
    request.cookies.get(resultCookie)?.value || "",
  );
  return NextResponse.json(
    receipt
      ? {
          userID: receipt.userID,
          outcome: receipt.outcome,
          attempt: receipt.challenge,
        }
      : { error: "Unverified result" },
    { status: receipt ? 200 : 401, headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const receipt = await verifyDeletionReceipt(
    process.env.APPLE_WEBSITE_RECEIPT_SECRET || "",
    request.cookies.get(resultCookie)?.value || "",
  );
  const body = await request.json().catch(() => null);
  if (!receipt || body?.attempt !== receipt.challenge)
    return NextResponse.json({ error: "Unverified result" }, { status: 401 });
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(resultCookie, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
