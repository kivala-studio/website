import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { WatchlistGroup } from "@/domain/account/watchlist";

import { readAll, unwrap } from "../supabase/read";

/** The account's groups, oldest first, with their members (contract §4.2). */
export async function readGroups(client: SupabaseClient, userID: string): Promise<WatchlistGroup[]> {
  const [groups, members] = await Promise.all([
    readAll<{ id: string; name: string; created_at: string }>((from, to) =>
      client.from("watchlist_groups").select("id,name,created_at").eq("user_id", userID).order("created_at").order("id").range(from, to),
    ),
    readAll<{ group_id: string; security_id: string }>((from, to) =>
      client
        .from("watchlist_group_items")
        .select("group_id,security_id")
        .eq("user_id", userID)
        .order("created_at")
        .order("group_id")
        .order("security_id")
        .range(from, to),
    ),
  ]);
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    createdAt: Date.parse(group.created_at) || 0,
    members: members.filter((member) => member.group_id === group.id).map((member) => member.security_id),
  }));
}

/** Creates a group with the client's id; a repeated create of the same id is ignored. Free raises `PLUS_REQUIRED`. */
export async function createGroup(client: SupabaseClient, userID: string, id: string, name: string): Promise<void> {
  unwrap(await client.from("watchlist_groups").upsert({ id, user_id: userID, name }, { onConflict: "id", ignoreDuplicates: true }));
}

export async function renameGroup(client: SupabaseClient, userID: string, id: string, name: string): Promise<void> {
  unwrap(await client.from("watchlist_groups").update({ name }).eq("user_id", userID).eq("id", id));
}

/** Deleting a group keeps its instruments in the watchlist. */
export async function deleteGroup(client: SupabaseClient, userID: string, id: string): Promise<void> {
  unwrap(await client.from("watchlist_groups").delete().eq("user_id", userID).eq("id", id));
}

export async function setGroupMember(client: SupabaseClient, userID: string, groupID: string, securityID: string, member: boolean): Promise<void> {
  if (member) {
    unwrap(
      await client
        .from("watchlist_group_items")
        .upsert({ group_id: groupID, user_id: userID, security_id: securityID }, { onConflict: "group_id,security_id", ignoreDuplicates: true }),
    );
  } else {
    unwrap(await client.from("watchlist_group_items").delete().eq("user_id", userID).eq("group_id", groupID).eq("security_id", securityID));
  }
}
