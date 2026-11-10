import { publicEnv } from "@/config/public-env";
import { createSnapshotProxy } from "@/data/market/snapshot-proxy";

const proxy =
  publicEnv.dataMode === "demo"
    ? undefined
    : createSnapshotProxy({ url: `${publicEnv.supabaseUrl}/functions/v1/market-snapshot`, key: publicEnv.supabaseKey! });

/** Demo mode: the recorded snapshot re-dated to now, scenario from `?scenario=` or the scenario cookie. */
async function demoResponse(request: Request): Promise<Response> {
  const { DEFAULT_DEMO_SCENARIO, DEMO_SCENARIO_COOKIE, demoSnapshot, isDemoScenario } = await import("@/data/market/demo/scenarios");
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === DEMO_SCENARIO_COOKIE)?.[1];
  const requested = new URL(request.url).searchParams.get("scenario") ?? cookie;
  const scenario = isDemoScenario(requested) ? requested : DEFAULT_DEMO_SCENARIO;
  const bundle = demoSnapshot(scenario, Date.now());
  const generatedAt = String(bundle.generated_at);
  return Response.json(bundle, {
    headers: { "cache-control": "no-store", etag: `W/"demo-${scenario}-${generatedAt}"`, "x-investao-generated-at": generatedAt },
  });
}

export async function GET(request: Request): Promise<Response> {
  return proxy ? proxy(request) : demoResponse(request);
}
