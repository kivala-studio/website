import "server-only";

import { unstable_cache } from "next/cache";

import { publicEnv } from "@/config/public-env";
import { demoScenario } from "@/data/demo/account";
import { type ListingEvent, decodeListingEvent } from "@/domain/market";
import { DAY_MS, addDays, civilDate } from "@/domain/market/zone";

import { anonymousSupabase } from "../supabase/anonymous-client";
import { unwrap } from "../supabase/read";

const COLUMNS =
  "id,kind,issuer_id,security_id,title,scheduled_date,starts_at,expires_at,status,confirmation_url,source_url,source_name,priority,highlights_home";

/** Current and upcoming new-listing events (anonymous, public, cached five minutes). */
const listingRows = unstable_cache(
  async () =>
    unwrap(
      await anonymousSupabase()
        .from("market_events")
        .select(COLUMNS)
        .eq("kind", "new_listing")
        .neq("status", "cancelled")
        .gt("expires_at", new Date().toISOString())
        .order("priority", { ascending: false })
        .limit(20),
    ) as unknown[],
  ["public-listings-v1"],
  { revalidate: 300, tags: ["public-listings"] },
);

/** Demo scenario `listing`: an invented company's admission, scheduled a week from today and highlighted on Home. */
function demoListingRows(now: number): unknown[] {
  return [
    {
      id: "d5e00000-0000-4000-8000-000000000101",
      kind: "new_listing",
      issuer_id: null,
      security_id: null,
      title: "Empresa de Demonstração, S.A.",
      scheduled_date: civilDate(addDays(now, 7)),
      starts_at: new Date(now - DAY_MS).toISOString(),
      expires_at: new Date(addDays(now, 14)).toISOString(),
      status: "scheduled",
      confirmation_url: null,
      source_url: "https://www.bodiva.ao",
      source_name: "BODIVA",
      priority: 500,
      highlights_home: true,
    },
  ];
}

/** Listing events to consider now; an unreadable feed is no event (the slot stays empty). */
export async function readListingEvents(now: number): Promise<ListingEvent[]> {
  try {
    const rows = publicEnv.dataMode === "demo" ? ((await demoScenario()) === "listing" ? demoListingRows(now) : []) : await listingRows();
    return rows.flatMap((row) => decodeListingEvent(row) ?? []);
  } catch {
    return [];
  }
}

export async function readListingEvent(id: string, now: number): Promise<ListingEvent | undefined> {
  return (await readListingEvents(now)).find((event) => event.id === id);
}
