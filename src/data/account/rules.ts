import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { type AlertRule, type MovementSensitivity, decodeAlertRule, isMovementSensitivity } from "@/domain/account/alerts";

import { readAll, unwrap } from "../supabase/read";

const COLUMNS = "id,security_id,kind,threshold,is_enabled,created_at";

/** Every alert rule of the account (contract §4.3); kinds this client does not know are skipped. */
export async function readRules(client: SupabaseClient, userID: string): Promise<AlertRule[]> {
  const rows = await readAll<unknown>((from, to) =>
    client.from("notification_rules").select(COLUMNS).eq("user_id", userID).order("created_at", { ascending: false }).order("id").range(from, to),
  );
  return rows.map(decodeAlertRule).filter((rule): rule is AlertRule => rule !== null);
}

/** Inserts with the client's id; a repeated save of the same id (after a lost answer) is ignored. */
export async function createRule(client: SupabaseClient, userID: string, rule: AlertRule): Promise<void> {
  unwrap(
    await client.from("notification_rules").upsert(
      { id: rule.id, user_id: userID, security_id: rule.securityID, kind: rule.kind, threshold: rule.threshold.toString(), is_enabled: rule.isEnabled },
      { onConflict: "id", ignoreDuplicates: true },
    ),
  );
}

export async function updateRule(client: SupabaseClient, userID: string, rule: AlertRule): Promise<void> {
  unwrap(
    await client
      .from("notification_rules")
      .update({ kind: rule.kind, threshold: rule.threshold.toString(), is_enabled: rule.isEnabled })
      .eq("user_id", userID)
      .eq("id", rule.id),
  );
}

export async function deleteRule(client: SupabaseClient, userID: string, id: string): Promise<void> {
  unwrap(await client.from("notification_rules").delete().eq("user_id", userID).eq("id", id));
}

/** `user_movement_preferences.sensitivity`; no row means `normal` (contract §4.5). */
export async function readSensitivity(client: SupabaseClient, userID: string): Promise<MovementSensitivity> {
  const rows = unwrap(await client.from("user_movement_preferences").select("sensitivity").eq("user_id", userID).limit(1)) as { sensitivity: unknown }[];
  const value = rows[0]?.sensitivity;
  return isMovementSensitivity(value) ? value : "normal";
}

export async function saveSensitivity(client: SupabaseClient, userID: string, sensitivity: MovementSensitivity): Promise<void> {
  unwrap(await client.from("user_movement_preferences").upsert({ user_id: userID, sensitivity }, { onConflict: "user_id" }));
}
