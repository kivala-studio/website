import { decodeWatchlistDocument } from "@/domain/account/watchlist";
import { DecodingError } from "@/domain/errors";
import { readAccountRoute, settle } from "@/features/account/results";

import * as actions from "./actions";
import { WatchlistChangedError, type WatchlistRepository } from "./watchlist-store";

/** The watchlist through `/api/account/watchlist` and its server actions, for one signed-in account. */
export function accountWatchlistRepository(userID: string): WatchlistRepository {
  return {
    async read() {
      const document = decodeWatchlistDocument(await readAccountRoute("/api/account/watchlist", userID));
      if (!document) throw new DecodingError("watchlist");
      return document;
    },
    add: async (id) => void (await settle(actions.addToWatchlist(userID, id), `watchlist.${id}`)),
    remove: (id) => settle(actions.removeFromWatchlist(userID, id), `watchlist.${id}`),
    restore: async (receipt) => void (await settle(actions.restoreToWatchlist(userID, receipt), "watchlist.undo")),
    async reorder(ids) {
      if ((await settle(actions.reorderList(userID, [...ids]), "watchlist.order")) === "changed") throw new WatchlistChangedError();
    },
    setAutomatic: async (id, enabled) => void (await settle(actions.setAutomaticMovements(userID, id, enabled), `automatic.${id}`)),
    createGroup: async (id, name) => void (await settle(actions.createGroup(userID, id, name), `group.${id}`)),
    renameGroup: async (id, name) => void (await settle(actions.renameGroup(userID, id, name), `group.${id}`)),
    deleteGroup: async (id) => void (await settle(actions.deleteGroup(userID, id), `group.${id}`)),
    setGroupMember: async (groupID, securityID, member) =>
      void (await settle(actions.setGroupMember(userID, groupID, securityID, member), `group.${groupID}.${securityID}`)),
    selectFree: (ids, movementID) => settle(actions.selectFreeWatchlist(userID, [...ids], movementID), "watchlist.freeSelection"),
    setSensitivity: async (value) => void (await settle(actions.setMovementSensitivity(userID, value), "movement.sensitivity")),
  };
}
