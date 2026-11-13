import "server-only";

import Decimal from "decimal.js";
import { cookies } from "next/headers";

import type { SubscriptionAccess } from "@/domain/account/access";
import { type AlertRule, type MovementSensitivity, acceptsThreshold, decodeAlertRule, encodeAlertRule, isMovementSensitivity } from "@/domain/account/alerts";
import type { WatchlistDocument, WatchlistGroup, WatchlistReceipt } from "@/domain/account/watchlist";

import { COOKIE_OPTIONS, type DemoAccount, demoAccess, demoComparisonPair, demoWatchlist, saveDemoWatchlist } from "./account";
import { DEMO_COOKIES } from "./tiers";

/*
 * Demo mode's watchlist details, groups and alert rules, kept in cookies of the same browser. Every write
 * applies the backend's rules (contract §4.1–4.3, §7.4) and refuses with the same error the server sends.
 */
const [, , , AUTOMATIC_COOKIE, GROUPS_COOKIE, RULES_COOKIE, SENSITIVITY_COOKIE] = DEMO_COOKIES;
const UUID = /^[0-9a-f-]{36}$/i;

/** A `P0001` business rule as PostgREST sends it. */
export const demoRule = (message: string, details: Record<string, unknown>) =>
  Object.assign(new Error(message), { code: "P0001", message, details: JSON.stringify(details), hint: null, status: 400 });

const sqlError = (code: string, message: string) => Object.assign(new Error(message), { code, message, details: null, hint: null, status: code === "23505" ? 409 : 400 });

async function readJSON(name: string): Promise<unknown[] | undefined> {
  const value = (await cookies()).get(name)?.value;
  if (value === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const save = async (name: string, value: string) => (await cookies()).set(name, value, COOKIE_OPTIONS);

/** Instruments with automatic movement alerts on: by default Free has its first, Plus every one. */
export async function demoAutomatic(account: DemoAccount, watchlist: readonly string[]): Promise<Set<string>> {
  const value = (await cookies()).get(AUTOMATIC_COOKIE)?.value;
  if (value === undefined) return new Set(account.tier === "free" ? watchlist.slice(0, 1) : watchlist);
  return new Set(value.split(".").filter((id) => UUID.test(id) && watchlist.includes(id)));
}

const saveAutomatic = (ids: Iterable<string>) => save(AUTOMATIC_COOKIE, [...ids].join("."));

export async function demoGroups(watchlist: readonly string[]): Promise<WatchlistGroup[]> {
  const rows = (await readJSON(GROUPS_COOKIE)) ?? [];
  return rows.flatMap((row): WatchlistGroup[] => {
    const value = row as Partial<WatchlistGroup>;
    if (typeof value.id !== "string" || typeof value.name !== "string" || !Array.isArray(value.members)) return [];
    return [{ id: value.id, name: value.name, createdAt: Number(value.createdAt) || 0, members: value.members.filter((id) => watchlist.includes(id)) }];
  });
}

const saveGroups = (groups: readonly WatchlistGroup[]) => save(GROUPS_COOKIE, JSON.stringify(groups));

/** Plus accounts start with one active rule on their first instrument and one paused on the second. */
export async function demoRules(account: DemoAccount, watchlist: readonly string[]): Promise<AlertRule[]> {
  const rows = await readJSON(RULES_COOKIE);
  if (rows === undefined) {
    if (account.tier === "free" || watchlist.length < 2) return [];
    return [
      { id: "d5e10000-0000-4000-8000-000000000001", securityID: watchlist[0], kind: "price_above", threshold: new Decimal(100_000), isEnabled: true, createdAt: Date.parse("2026-11-02T09:00:00Z") },
      { id: "d5e10000-0000-4000-8000-000000000002", securityID: watchlist[1], kind: "percent_change_below", threshold: new Decimal(-5), isEnabled: false, createdAt: Date.parse("2026-11-01T09:00:00Z") },
    ];
  }
  return rows.map(decodeAlertRule).filter((rule): rule is AlertRule => rule !== null);
}

const saveRules = (rules: readonly AlertRule[]) => save(RULES_COOKIE, JSON.stringify(rules.map(encodeAlertRule)));

export async function demoSensitivity(): Promise<MovementSensitivity> {
  const value = (await cookies()).get(SENSITIVITY_COOKIE)?.value;
  return isMovementSensitivity(value) ? value : "normal";
}

/** The access document from every demo cookie. */
export async function demoCurrentAccess(account: DemoAccount, watchlist?: readonly string[]): Promise<SubscriptionAccess> {
  const list = watchlist ?? (await demoWatchlist());
  return demoAccess(account, list, await demoComparisonPair(), await demoAutomatic(account, list));
}

export async function demoWatchlistDocument(account: DemoAccount): Promise<WatchlistDocument> {
  const watchlist = await demoWatchlist();
  const automatic = await demoAutomatic(account, watchlist);
  return {
    items: watchlist.map((id) => ({ id, automaticAlerts: automatic.has(id) })),
    groups: await demoGroups(watchlist),
    access: demoAccess(account, watchlist, await demoComparisonPair(), automatic),
    sensitivity: await demoSensitivity(),
  };
}

// MARK: Writes

const RECEIPT_CREATED_AT = "2026-10-01T09:00:00.000Z";

/** Inserts at the end. Free: a 4th row is refused; a row added while another has alerts on stays off. */
export async function demoAdd(account: DemoAccount, id: string): Promise<void> {
  const list = await demoWatchlist();
  if (list.includes(id)) return;
  if (account.tier === "free" && list.length >= 3) throw demoRule("FREE_WATCHLIST_LIMIT", { feature: "watchlist", limit: 3 });
  const automatic = await demoAutomatic(account, list);
  if (account.tier !== "free" || automatic.size === 0) automatic.add(id);
  await saveDemoWatchlist([...list, id]);
  await saveAutomatic(automatic);
}

export async function demoRemove(account: DemoAccount, id: string): Promise<WatchlistReceipt | null> {
  const list = await demoWatchlist();
  const index = list.indexOf(id);
  if (index < 0) return null;
  const automatic = await demoAutomatic(account, list);
  const next = list.filter((item) => item !== id);
  await saveDemoWatchlist(next);
  await saveAutomatic([...automatic].filter((item) => item !== id));
  await saveGroups((await demoGroups(list)).map((group) => ({ ...group, members: group.members.filter((member) => member !== id) })));
  return { userID: account.id, securityID: id, sortOrder: index, automaticAlertsEnabled: automatic.has(id), createdAt: RECEIPT_CREATED_AT };
}

/** The exact row back at its sort position; a newer row for the instrument makes it fail (`23505`). */
export async function demoRestore(account: DemoAccount, receipt: WatchlistReceipt): Promise<void> {
  const list = await demoWatchlist();
  if (list.includes(receipt.securityID)) throw sqlError("23505", 'duplicate key value violates unique constraint "watchlist_items_pkey"');
  const automatic = await demoAutomatic(account, list);
  const next = [...list];
  next.splice(Math.min(receipt.sortOrder, next.length), 0, receipt.securityID);
  await saveDemoWatchlist(next);
  if (receipt.automaticAlertsEnabled) automatic.add(receipt.securityID);
  await saveAutomatic(automatic);
}

/** `reorder_watchlist`: the ids must be exactly the saved membership. */
export async function demoReorder(ids: readonly string[]): Promise<void> {
  const list = await demoWatchlist();
  if (new Set(ids).size !== ids.length) throw sqlError("22023", "Duplicate or null securities");
  if ([...ids].sort().join() !== [...list].sort().join()) throw sqlError("22023", "Watchlist membership changed; reload before reordering");
  await saveDemoWatchlist(ids);
}

/** Free: one instrument, within the active three. */
export async function demoSetAutomatic(account: DemoAccount, id: string, enabled: boolean): Promise<void> {
  const list = await demoWatchlist();
  if (!list.includes(id)) return;
  const automatic = await demoAutomatic(account, list);
  if (enabled && account.tier === "free" && !automatic.has(id)) {
    if (automatic.size >= 1 || !list.slice(0, 3).includes(id)) throw demoRule("FREE_MOVEMENT_LIMIT", { feature: "movement_alerts", limit: 1 });
  }
  if (enabled) automatic.add(id);
  else automatic.delete(id);
  await saveAutomatic(automatic);
}

/** `select_free_watchlist`: the chosen three move to the front; only the movement instrument keeps alerts. */
export async function demoSelectFree(account: DemoAccount, ids: readonly string[], movementID: string | null): Promise<SubscriptionAccess> {
  const list = await demoWatchlist();
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length || unique.some((id) => !list.includes(id)) || (movementID !== null && !unique.includes(movementID))) {
    throw sqlError("22023", "Invalid Free selection");
  }
  if (unique.length !== Math.min(3, list.length)) throw sqlError("22023", "Choose up to three saved instruments");
  const next = [...unique, ...list.filter((id) => !unique.includes(id))];
  await saveDemoWatchlist(next);
  const automatic = account.tier === "free" ? new Set(movementID ? [movementID] : []) : await demoAutomatic(account, list);
  await saveAutomatic(automatic);
  return demoAccess(account, next, await demoComparisonPair(), automatic);
}

export async function demoSaveSensitivity(value: MovementSensitivity): Promise<void> {
  await save(SENSITIVITY_COOKIE, value);
}

const GROUP_LIMIT = 20;
const sameName = (a: string, b: string) => a.localeCompare(b, "pt", { sensitivity: "accent" }) === 0;

function checkName(groups: readonly WatchlistGroup[], name: string, except?: string) {
  if (name.trim() !== name || name.length < 1 || [...name].length > 40) throw sqlError("23514", "watchlist_groups_name_check");
  if (groups.some((group) => group.id !== except && sameName(group.name, name))) throw sqlError("23505", "watchlist_groups_user_name_key");
}

export async function demoCreateGroup(account: DemoAccount, id: string, name: string): Promise<void> {
  const list = await demoWatchlist();
  const groups = await demoGroups(list);
  if (groups.some((group) => group.id === id)) return;
  if (account.tier === "free") throw demoRule("PLUS_REQUIRED", { feature: "watchlist_groups" });
  if (groups.length >= GROUP_LIMIT) throw demoRule("WATCHLIST_GROUP_LIMIT", { feature: "watchlist_groups", limit: GROUP_LIMIT });
  checkName(groups, name);
  await saveGroups([...groups, { id, name, createdAt: Date.now(), members: [] }]);
}

export async function demoRenameGroup(id: string, name: string): Promise<void> {
  const groups = await demoGroups(await demoWatchlist());
  checkName(groups, name, id);
  await saveGroups(groups.map((group) => (group.id === id ? { ...group, name } : group)));
}

export async function demoDeleteGroup(id: string): Promise<void> {
  await saveGroups((await demoGroups(await demoWatchlist())).filter((group) => group.id !== id));
}

export async function demoSetGroupMember(account: DemoAccount, groupID: string, securityID: string, member: boolean): Promise<void> {
  const list = await demoWatchlist();
  const groups = await demoGroups(list);
  const group = groups.find((item) => item.id === groupID);
  if (!group) return;
  if (member) {
    if (group.members.includes(securityID)) return;
    if (account.tier === "free") throw demoRule("PLUS_REQUIRED", { feature: "watchlist_groups" });
    if (!list.includes(securityID)) throw sqlError("23503", "watchlist_group_items_watchlist_fkey");
  }
  const members = member ? [...group.members, securityID] : group.members.filter((id) => id !== securityID);
  await saveGroups(groups.map((item) => (item.id === groupID ? { ...item, members } : item)));
}

const RULE_LIMIT = { free: 2, plus: 100, pro: 100 } as const;

function checkRule(rules: readonly AlertRule[], rule: AlertRule) {
  if (!acceptsThreshold(rule.kind, rule.threshold)) throw sqlError("23514", "notification_rules_threshold_by_kind");
  const duplicate = rules.some(
    (other) => other.id !== rule.id && other.securityID === rule.securityID && other.kind === rule.kind && other.threshold.eq(rule.threshold),
  );
  if (duplicate) throw sqlError("23505", "notification_rules_user_id_security_id_kind_threshold_key");
}

export async function demoCreateRule(account: DemoAccount, rule: AlertRule): Promise<void> {
  const rules = await demoRules(account, await demoWatchlist());
  if (rules.some((other) => other.id === rule.id)) return;
  if (rules.length >= RULE_LIMIT[account.tier]) {
    if (account.tier === "free") throw demoRule("PLUS_REQUIRED", { feature: "alert_rules", limit: RULE_LIMIT.free });
    throw sqlError("23514", "Account resource limit reached (100)");
  }
  checkRule(rules, rule);
  await saveRules([{ ...rule, createdAt: Date.now() }, ...rules]);
}

export async function demoUpdateRule(account: DemoAccount, rule: AlertRule): Promise<void> {
  const rules = await demoRules(account, await demoWatchlist());
  const current = rules.find((other) => other.id === rule.id);
  if (!current) return;
  checkRule(rules, rule);
  await saveRules(rules.map((other) => (other.id === rule.id ? { ...rule, createdAt: current.createdAt } : other)));
}

export async function demoDeleteRule(account: DemoAccount, id: string): Promise<void> {
  await saveRules((await demoRules(account, await demoWatchlist())).filter((rule) => rule.id !== id));
}
