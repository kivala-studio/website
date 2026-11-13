import "server-only";

import type { AccountSession } from "@/data/account/session";
import { demoScenario } from "@/data/demo/account";
import { demoMarketPeriodEvidence } from "@/data/demo/intelligence-evidence";
import { unwrap } from "@/data/supabase/read";
import type { EpochMs } from "@/domain/market/zone";

import { type EvidencePeriod, evidenceParameters } from "./evidence";

/**
 * The raw `get_market_period_evidence` response for this account (or the demo response), for a route that hands
 * it to the browser unchanged; the browser validates it with `decodeMarketPeriodEvidence`.
 */
export async function readMarketPeriodEvidenceJSON(session: AccountSession, period: EvidencePeriod, now: EpochMs): Promise<unknown> {
  const parameters = evidenceParameters(period);
  if (session.kind === "demo") return demoMarketPeriodEvidence(await demoScenario(), parameters.starts_on, parameters.ends_on, now);
  return unwrap(await session.client.rpc("get_market_period_evidence", parameters));
}
