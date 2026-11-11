"use server";

import { accountSession, isUUID } from "@/data/account/session";
import { authorizeComparison as authorizeOnServer } from "@/data/account/reads";
import { addOneToWatchlist, removeFromWatchlist } from "@/data/account/watchlist";
import { demoAccess, demoComparisonPair, demoWatchlist, saveDemoComparisonPair, saveDemoWatchlist } from "@/data/demo/account";
import { recordedSnapshot } from "@/data/market/demo/scenarios";
import type { SubscriptionAccess } from "@/domain/account/access";
import { AccountSessionError, type AppErrorCategory, type ServerRule, mapError } from "@/domain/errors";

import { readAccountState } from "./state";

/** What an account write sends back. `stale`: the session belongs to another account now (nothing was written). */
export type AccountResult<T> =
  | { status: "ok"; value: T }
  | { status: "stale" }
  | { status: "failed"; error: { category: AppErrorCategory; httpStatus: number | null; rule: ServerRule | null } };

function failed(error: unknown, operation: string): AccountResult<never> {
  const mapped = mapError(error, operation);
  if (!mapped) return { status: "stale" };
  return { status: "failed", error: { category: mapped.category, httpStatus: mapped.httpStatus, rule: mapped.rule } };
}

/** A `P0001` business rule as PostgREST sends it, for the demo account. */
const rule = (message: string, details: Record<string, unknown>) => Object.assign(new Error(message), { code: "P0001", message, details: JSON.stringify(details), status: 400 });

export type WatchlistChange = { watchlist: string[]; access: SubscriptionAccess | null };

/** Stars or unstars one instrument while the verified session is still `expectedUserID`; returns the saved list. */
export async function setWatched(expectedUserID: string, securityID: string, watched: boolean): Promise<AccountResult<WatchlistChange>> {
  const operation = "watchlist.update";
  try {
    const session = await accountSession();
    if (!session) return failed(new AccountSessionError(), operation);
    if (session.userID !== expectedUserID) return { status: "stale" };
    if (!isUUID(securityID)) return failed(rule("Invalid instrument", {}), operation);
    if (session.kind === "demo") {
      const list = await demoWatchlist();
      const has = list.includes(securityID);
      if (watched && !has && session.account.tier === "free" && list.length >= 3) {
        throw rule("FREE_WATCHLIST_LIMIT", { feature: "watchlist", limit: 3 });
      }
      const next = watched ? (has ? list : [...list, securityID]) : list.filter((id) => id !== securityID);
      await saveDemoWatchlist(next);
      return { status: "ok", value: { watchlist: next, access: demoAccess(session.account, next, await demoComparisonPair()) } };
    }
    if (watched) await addOneToWatchlist(session.client, session.userID, securityID);
    else await removeFromWatchlist(session.client, session.userID, securityID);
    const state = await readAccountState(session);
    return { status: "ok", value: { watchlist: [...state.watchlist], access: state.access } };
  } catch (error) {
    return failed(error, operation);
  }
}

const kindOf = (id: string) => recordedSnapshot.securities.find((security) => security.id === id)?.security_type;

/**
 * `authorize_chart_comparison` for the canonical set of 2–3 instruments (iOS `authorizeComparison`). The Free
 * pair is spent only by this call; the caller has already checked two shared observations.
 */
export async function authorizeComparison(expectedUserID: string, securityIDs: string[]): Promise<AccountResult<SubscriptionAccess | null>> {
  const operation = "comparison.authorize";
  try {
    const session = await accountSession();
    if (!session) return failed(new AccountSessionError(), operation);
    if (session.userID !== expectedUserID) return { status: "stale" };
    const ids = [...new Set(securityIDs)].sort();
    if (ids.length < 2 || ids.length > 3 || !ids.every(isUUID)) throw rule("Invalid comparison instruments", {});
    if (session.kind === "demo") {
      if (new Set(ids.map(kindOf)).size !== 1) throw Object.assign(new Error("Incompatible comparison instruments"), { code: "22023", status: 400 });
      const list = await demoWatchlist();
      if (session.account.tier === "free") {
        if (ids.length > 2) throw rule("FREE_COMPARISON_SIZE_LIMIT", { limit: 2 });
        const pair = await demoComparisonPair();
        if (pair && pair.join() !== ids.join()) throw rule("FREE_COMPARISON_WEEK_LIMIT", { limit: 1 });
        if (!pair) await saveDemoComparisonPair(ids);
      }
      return { status: "ok", value: demoAccess(session.account, list, session.account.tier === "free" ? ids : null) };
    }
    return { status: "ok", value: await authorizeOnServer(session.client, ids) };
  } catch (error) {
    return failed(error, operation);
  }
}
