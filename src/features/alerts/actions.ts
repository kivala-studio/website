"use server";

import { createRule, deleteRule, updateRule } from "@/data/account/rules";
import { isUUID } from "@/data/account/session";
import { demoCreateRule, demoDeleteRule, demoUpdateRule } from "@/data/demo/watchlist";
import { type AlertRule, acceptsThreshold, decodeAlertRule } from "@/domain/account/alerts";
import { type AccountResult, accountWrite, invalidArgument } from "@/features/account/write";

/** The JSON a client sends for a rule (`encodeAlertRule`): thresholds as exact strings. */
export type AlertRuleWire = { id: string; securityID: string; kind: string; threshold: string; isEnabled: boolean; createdAt: number };

function decoded(wire: AlertRuleWire): AlertRule {
  const rule = decodeAlertRule(wire);
  if (!rule || !isUUID(rule.id) || !isUUID(rule.securityID) || !acceptsThreshold(rule.kind, rule.threshold)) throw invalidArgument();
  return rule;
}

/** Creates a rule with the client's id: repeating the same save after a lost answer creates no second row. */
export async function createAlertRule(expectedUserID: string, wire: AlertRuleWire): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, `alert.${wire?.id}`, async (session) => {
    const rule = decoded(wire);
    if (session.kind === "demo") await demoCreateRule(session.account, rule);
    else await createRule(session.client, session.userID, rule);
    return null;
  });
}

export async function updateAlertRule(expectedUserID: string, wire: AlertRuleWire): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, `alert.${wire?.id}`, async (session) => {
    const rule = decoded(wire);
    if (session.kind === "demo") await demoUpdateRule(session.account, rule);
    else await updateRule(session.client, session.userID, rule);
    return null;
  });
}

export async function deleteAlertRule(expectedUserID: string, ruleID: string): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, `alert.${ruleID}`, async (session) => {
    if (!isUUID(ruleID)) throw invalidArgument();
    if (session.kind === "demo") await demoDeleteRule(session.account, ruleID);
    else await deleteRule(session.client, session.userID, ruleID);
    return null;
  });
}
