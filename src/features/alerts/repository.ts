import { type AlertRule, decodeAlertRule, encodeAlertRule } from "@/domain/account/alerts";
import { DecodingError } from "@/domain/errors";
import { readAccountRoute, settle } from "@/features/account/results";

import { createAlertRule, deleteAlertRule, updateAlertRule } from "./actions";
import type { AlertRepository } from "./alerts-store";

/** Alert rules through `/api/account/alerts` and their server actions, for one signed-in account. */
export function accountAlertRepository(userID: string): AlertRepository {
  return {
    async read(signal) {
      const body = await readAccountRoute("/api/account/alerts", userID, signal);
      if (!Array.isArray(body.rules)) throw new DecodingError("alerts");
      return body.rules.map(decodeAlertRule).filter((rule): rule is AlertRule => rule !== null);
    },
    create: async (rule) => void (await settle(createAlertRule(userID, encodeAlertRule(rule)), `alert.${rule.id}`)),
    update: async (rule) => void (await settle(updateAlertRule(userID, encodeAlertRule(rule)), `alert.${rule.id}`)),
    delete: async (id) => void (await settle(deleteAlertRule(userID, id), `alert.${id}`)),
  };
}
