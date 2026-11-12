"use server";

import { isUUID } from "@/data/account/session";
import { authorizeComparison as authorizeOnServer } from "@/data/account/reads";
import { demoAccess, demoComparisonPair, demoWatchlist, saveDemoComparisonPair } from "@/data/demo/account";
import { demoAutomatic, demoRule } from "@/data/demo/watchlist";
import { recordedSnapshot } from "@/data/market/demo/scenarios";
import type { SubscriptionAccess } from "@/domain/account/access";

import { type AccountResult, accountWrite } from "./write";

export type { AccountResult } from "./write";

const kindOf = (id: string) => recordedSnapshot.securities.find((security) => security.id === id)?.security_type;

/**
 * `authorize_chart_comparison` for the canonical set of 2–3 instruments (iOS `authorizeComparison`). The Free
 * pair is spent only by this call; the caller has already checked two shared observations.
 */
export async function authorizeComparison(expectedUserID: string, securityIDs: string[]): Promise<AccountResult<SubscriptionAccess | null>> {
  return accountWrite(expectedUserID, "comparison.authorize", async (session) => {
    const ids = [...new Set(securityIDs)].sort();
    if (ids.length < 2 || ids.length > 3 || !ids.every(isUUID)) throw demoRule("Invalid comparison instruments", {});
    if (session.kind === "supabase") return authorizeOnServer(session.client, ids);
    if (new Set(ids.map(kindOf)).size !== 1) throw Object.assign(new Error("Incompatible comparison instruments"), { code: "22023", status: 400 });
    const list = await demoWatchlist();
    if (session.account.tier === "free") {
      if (ids.length > 2) throw demoRule("FREE_COMPARISON_SIZE_LIMIT", { limit: 2 });
      const pair = await demoComparisonPair();
      if (pair && pair.join() !== ids.join()) throw demoRule("FREE_COMPARISON_WEEK_LIMIT", { limit: 1 });
      if (!pair) await saveDemoComparisonPair(ids);
    }
    return demoAccess(session.account, list, session.account.tier === "free" ? ids : null, await demoAutomatic(session.account, list));
  });
}
