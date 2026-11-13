import type { SupabaseClient } from "@supabase/supabase-js";

import type { PersonalisationAggregate, PersonalisationRepository } from "@/domain/personalisation";

import { readAll, unwrap } from "../supabase/read";

/*
 * `user_activity_daily` (contract S1/S2): daily aggregated counters, never raw events. Owner-scoped by RLS.
 */

const COLUMNS = "user_id,installation_id,activity_day,kind,security_id,related_security_id,variant,activity_count";
const CONFLICT = "user_id,installation_id,activity_day,kind,security_id,related_security_id,variant";

type Row = {
  user_id: string;
  installation_id: string;
  activity_day: string;
  kind: string;
  security_id: string | null;
  related_security_id: string | null;
  variant: string;
  activity_count: number;
};

const lower = (value: string | null) => (value === null ? null : value.toLowerCase());

function decode(row: unknown): PersonalisationAggregate | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Partial<Row>;
  if (typeof r.user_id !== "string" || typeof r.installation_id !== "string" || typeof r.activity_day !== "string" || typeof r.kind !== "string") return null;
  if (typeof r.variant !== "string" || !Number.isInteger(r.activity_count)) return null;
  const security = r.security_id ?? null;
  const related = r.related_security_id ?? null;
  if ((security !== null && typeof security !== "string") || (related !== null && typeof related !== "string")) return null;
  return {
    userID: r.user_id.toLowerCase(),
    installationID: r.installation_id.toLowerCase(),
    activityDay: r.activity_day.slice(0, 10),
    kind: r.kind,
    securityID: lower(security),
    relatedSecurityID: lower(related),
    variant: r.variant,
    activityCount: r.activity_count as number,
  };
}

export function supabasePersonalisationRepository(client: SupabaseClient): PersonalisationRepository {
  return {
    async upsert(rows) {
      if (rows.length === 0) return;
      const values: Row[] = rows.map((row) => ({
        user_id: row.userID,
        installation_id: row.installationID,
        activity_day: row.activityDay,
        kind: row.kind,
        security_id: row.securityID,
        related_security_id: row.relatedSecurityID,
        variant: row.variant,
        activity_count: row.activityCount,
      }));
      unwrap(await client.from("user_activity_daily").upsert(values, { onConflict: CONFLICT }));
    },
    async fetch(userID, sinceDay) {
      const rows = await readAll<unknown>((from, to) =>
        client
          .from("user_activity_daily")
          .select(COLUMNS)
          .eq("user_id", userID)
          .gte("activity_day", sinceDay)
          .order("activity_day", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      );
      return rows.map(decode).filter((row): row is PersonalisationAggregate => row !== null);
    },
  };
}
