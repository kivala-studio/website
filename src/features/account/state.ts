import "server-only";

import { type AccountSession } from "@/data/account/session";
import { readSubscriptionAccess } from "@/data/account/reads";
import { readWatchlist } from "@/data/account/watchlist";
import { demoWatchlist } from "@/data/demo/account";
import { demoCurrentAccess } from "@/data/demo/watchlist";
import type { SubscriptionAccess } from "@/domain/account/access";

/** What every signed-in page knows about the account: its watchlist in order and its plan access. */
export interface AccountState {
  readonly userID: string;
  readonly watchlist: readonly string[];
  /** Null when it could not be read: nothing is locked then (the server still enforces). */
  readonly access: SubscriptionAccess | null;
}

/** The account's state; a failed read leaves that part empty rather than failing the page. */
export async function readAccountState(session: AccountSession): Promise<AccountState & { watchlistFailed: boolean }> {
  if (session.kind === "demo") {
    const watchlist = await demoWatchlist();
    return { userID: session.userID, watchlist, access: await demoCurrentAccess(session.account, watchlist), watchlistFailed: false };
  }
  const [watchlist, access] = await Promise.all([
    readWatchlist(session.client, session.userID).catch(() => null),
    readSubscriptionAccess(session.client).catch(() => null),
  ]);
  return { userID: session.userID, watchlist: watchlist ?? [], access, watchlistFailed: watchlist === null };
}
