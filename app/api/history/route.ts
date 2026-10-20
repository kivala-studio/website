import { NextRequest, NextResponse } from "next/server";
import { history } from "../../../lib/history";
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))
    return NextResponse.json({ error: "Invalid instrument" }, { status: 400 });
  try {
    return NextResponse.json(await history(id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "History unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
