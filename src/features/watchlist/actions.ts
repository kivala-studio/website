"use server";

import * as groups from "@/data/account/groups";
import { saveSensitivity } from "@/data/account/rules";
import { isUUID } from "@/data/account/session";
import {
  addOneToWatchlist,
  removeWithReceipt,
  reorderWatchlist,
  restoreWatchlistRow,
  selectFreeWatchlist as selectFreeOnServer,
  setAutomaticAlerts,
} from "@/data/account/watchlist";
import * as demo from "@/data/demo/watchlist";
import type { SubscriptionAccess } from "@/domain/account/access";
import { isMovementSensitivity } from "@/domain/account/alerts";
import { type WatchlistReceipt, decodeReceipt } from "@/domain/account/watchlist";
import { groupName } from "@/domain/account/watchlist-ordering";
import { CancellationError, postgrestCode } from "@/domain/errors";
import { type AccountResult, accountWrite, invalidArgument } from "@/features/account/write";

/*
 * The watchlist's writes (contract §4.1, §4.2, §4.5): each one for the verified session while it is still
 * `expectedUserID`, directly under row-level security, or against the demo account's cookies.
 */

function id(value: unknown): string {
  if (!isUUID(value)) throw invalidArgument();
  return value;
}

export async function addToWatchlist(expectedUserID: string, securityID: string): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, `watchlist.${securityID}`, async (session) => {
    const security = id(securityID);
    if (session.kind === "demo") await demo.demoAdd(session.account, security);
    else await addOneToWatchlist(session.client, session.userID, security);
    return null;
  });
}

/** Deletes one row and returns it, so an undo can put exactly it back. */
export async function removeFromWatchlist(expectedUserID: string, securityID: string): Promise<AccountResult<WatchlistReceipt | null>> {
  return accountWrite(expectedUserID, `watchlist.${securityID}`, async (session) => {
    const security = id(securityID);
    return session.kind === "demo" ? demo.demoRemove(session.account, security) : removeWithReceipt(session.client, session.userID, security);
  });
}

/** Re-inserts a deleted row; a receipt of another account is refused as stale. */
export async function restoreToWatchlist(expectedUserID: string, receipt: WatchlistReceipt): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, "watchlist.undo", async (session) => {
    const row = decodeReceipt(receipt);
    if (!row || !isUUID(row.securityID) || Number.isNaN(Date.parse(row.createdAt))) throw invalidArgument();
    if (row.userID !== session.userID) throw new CancellationError();
    if (session.kind === "demo") await demo.demoRestore(session.account, row);
    else await restoreWatchlistRow(session.client, row);
    return null;
  });
}

/** `reorder_watchlist`. `changed`: the membership moved on elsewhere; the list reloads. */
export async function reorderList(expectedUserID: string, securityIDs: string[]): Promise<AccountResult<"saved" | "changed">> {
  return accountWrite(expectedUserID, "watchlist.order", async (session) => {
    if (!Array.isArray(securityIDs)) throw invalidArgument();
    const ids = securityIDs.map(id);
    try {
      if (session.kind === "demo") await demo.demoReorder(ids);
      else await reorderWatchlist(session.client, ids);
      return "saved";
    } catch (error) {
      const message = (error as { message?: unknown }).message;
      if (postgrestCode(error) === "22023" && typeof message === "string" && message.includes("membership changed")) return "changed";
      throw error;
    }
  });
}

export async function setAutomaticMovements(expectedUserID: string, securityID: string, enabled: boolean): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, `automatic.${securityID}`, async (session) => {
    const security = id(securityID);
    if (typeof enabled !== "boolean") throw invalidArgument();
    if (session.kind === "demo") await demo.demoSetAutomatic(session.account, security, enabled);
    else await setAutomaticAlerts(session.client, session.userID, security, enabled);
    return null;
  });
}

export async function setMovementSensitivity(expectedUserID: string, value: string): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, "movement.sensitivity", async (session) => {
    if (!isMovementSensitivity(value)) throw invalidArgument();
    if (session.kind === "demo") await demo.demoSaveSensitivity(value);
    else await saveSensitivity(session.client, session.userID, value);
    return null;
  });
}

/** `select_free_watchlist`: up to three active instruments and the one with automatic movements. */
export async function selectFreeWatchlist(expectedUserID: string, securityIDs: string[], movementID: string | null): Promise<AccountResult<SubscriptionAccess | null>> {
  return accountWrite(expectedUserID, "watchlist.freeSelection", async (session) => {
    if (!Array.isArray(securityIDs) || securityIDs.length > 3) throw invalidArgument();
    const ids = securityIDs.map(id);
    const movement = movementID === null ? null : id(movementID);
    return session.kind === "demo" ? demo.demoSelectFree(session.account, ids, movement) : selectFreeOnServer(session.client, ids, movement);
  });
}

function name(value: unknown): string {
  if (typeof value !== "string" || groupName(value) !== value) throw invalidArgument();
  return value;
}

export async function createGroup(expectedUserID: string, groupID: string, groupNameValue: string): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, `group.${groupID}`, async (session) => {
    const [group, value] = [id(groupID), name(groupNameValue)];
    if (session.kind === "demo") await demo.demoCreateGroup(session.account, group, value);
    else await groups.createGroup(session.client, session.userID, group, value);
    return null;
  });
}

export async function renameGroup(expectedUserID: string, groupID: string, groupNameValue: string): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, `group.${groupID}`, async (session) => {
    const [group, value] = [id(groupID), name(groupNameValue)];
    if (session.kind === "demo") await demo.demoRenameGroup(group, value);
    else await groups.renameGroup(session.client, session.userID, group, value);
    return null;
  });
}

export async function deleteGroup(expectedUserID: string, groupID: string): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, `group.${groupID}`, async (session) => {
    const group = id(groupID);
    if (session.kind === "demo") await demo.demoDeleteGroup(group);
    else await groups.deleteGroup(session.client, session.userID, group);
    return null;
  });
}

export async function setGroupMember(expectedUserID: string, groupID: string, securityID: string, member: boolean): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, `group.${groupID}.${securityID}`, async (session) => {
    const [group, security] = [id(groupID), id(securityID)];
    if (typeof member !== "boolean") throw invalidArgument();
    if (session.kind === "demo") await demo.demoSetGroupMember(session.account, group, security, member);
    else await groups.setGroupMember(session.client, session.userID, group, security, member);
    return null;
  });
}
