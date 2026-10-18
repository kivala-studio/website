import type { SupabaseClient } from "@supabase/supabase-js";
/** Only use after a verified deletion result, never from a URL status string. */
export async function finishDeletedAccount(
  client: SupabaseClient,
  deletedUserID: string,
  clearLocalData: (userID: string) => Promise<void>,
) {
  const {
    data: { session },
  } = await client.auth.getSession();
  if (session?.user.id === deletedUserID) {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
  }
  // A different signed-in account remains active; only the deleted account's local data is removed.
  await clearLocalData(deletedUserID);
}
