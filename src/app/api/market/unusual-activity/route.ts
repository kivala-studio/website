import { publicEnv } from "@/config/public-env";
import { requestTime } from "@/data/clock";

const HEADERS = { "cache-control": "no-store" } as const;

/**
 * The latest session's unusual activity (`get_unusual_activity`, contract §3.10): public market information, read
 * as `anon`. Rows go to the browser as the RPC returns them; the page decodes them.
 */
export async function GET(): Promise<Response> {
  try {
    if (publicEnv.dataMode === "demo") {
      const [{ demoScenario }, { demoUnusualActivityRows }] = await Promise.all([import("@/data/demo/account"), import("@/data/market/demo/unusual-activity")]);
      return Response.json({ rows: demoUnusualActivityRows(await demoScenario(), requestTime()) }, { headers: HEADERS });
    }
    const { readUnusualActivityRows } = await import("@/data/market/unusual-activity");
    return Response.json({ rows: await readUnusualActivityRows() }, { headers: HEADERS });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: HEADERS });
  }
}
