import "server-only";

import { anonymousSupabase } from "@/data/supabase/anonymous-client";
import { DecodingError } from "@/domain/errors";

import { unwrap } from "../supabase/read";

/** Rows of the latest date with events (up to 200, newest first), unchanged. */
export async function readUnusualActivityRows(): Promise<unknown[]> {
  const rows: unknown = unwrap(await anonymousSupabase().rpc("get_unusual_activity"));
  if (!Array.isArray(rows)) throw new DecodingError("unusualActivity");
  return rows;
}
