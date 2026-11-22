import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import type { SubscriptionAccess } from "../account/access";

import {
  NO_PLUS_PROMPT_DISMISSAL,
  PLUS_OFFER_SNOOZE_MS,
  PLUS_RENEW_WINDOW_MS,
  decodePlusPromptDismissal,
  dismissPlusPrompt,
  encodePlusPromptDismissal,
  plusEndKey,
  plusPrompt,
  plusPromptCandidate,
} from "./plus-prompt";
import type { WebPlan } from "./web-pass";

const NOW = Date.parse("2026-11-22T12:00:00Z");
const DAY = 24 * 60 * 60_000;
const PLANS: WebPlan[] = [{ id: "plus_1m", months: 1, priceAOA: new Decimal("1000") }];
const NONE = NO_PLUS_PROMPT_DISMISSAL;

const access = (fields: Partial<SubscriptionAccess>): SubscriptionAccess => ({
  isPlus: false,
  enforcementEnabled: true,
  weekStart: null,
  resetsAt: null,
  comparisonPair: null,
  activeWatchlistIDs: [],
  movementSecurityID: null,
  plusUntil: null,
  storeSubscription: null,
  ...fields,
});

const FREE = access({});
const until = (ms: number) => new Date(NOW + ms).toISOString();
const prepaid = (ms: number) => access({ isPlus: true, plusUntil: until(ms), storeSubscription: false });

describe("plusPrompt", () => {
  it("offers Plus to an account that limits apply to, only while passes are on sale", () => {
    expect(plusPrompt(FREE, PLANS, NOW, NONE)).toBe("offer");
    expect(plusPrompt(FREE, [], NOW, NONE)).toBeNull();
    expect(plusPrompt(FREE, null, NOW, NONE)).toBeNull();
    expect(plusPrompt(access({ enforcementEnabled: false }), PLANS, NOW, NONE)).toBeNull();
  });

  it("shows nothing while access or the dismissal is unknown", () => {
    expect(plusPrompt(null, PLANS, NOW, NONE)).toBeNull();
    expect(plusPrompt(FREE, PLANS, NOW, null)).toBeNull();
  });

  it("keeps a dismissed offer away for 30 days", () => {
    const dismissed = dismissPlusPrompt(NONE, "offer", FREE, NOW);
    expect(plusPrompt(FREE, PLANS, NOW + PLUS_OFFER_SNOOZE_MS - 1, dismissed)).toBeNull();
    expect(plusPrompt(FREE, PLANS, NOW + PLUS_OFFER_SNOOZE_MS, dismissed)).toBe("offer");
  });

  it("asks to renew prepaid Plus that ends within 7 days, boundary included", () => {
    expect(plusPrompt(prepaid(PLUS_RENEW_WINDOW_MS), PLANS, NOW, NONE)).toBe("renew");
    expect(plusPrompt(prepaid(PLUS_RENEW_WINDOW_MS + 1), PLANS, NOW, NONE)).toBeNull();
    expect(plusPrompt(prepaid(60_000), PLANS, NOW, NONE)).toBe("renew");
    expect(plusPrompt(prepaid(0), PLANS, NOW, NONE)).toBeNull();
    expect(plusPrompt(prepaid(60_000), [], NOW, NONE)).toBeNull();
  });

  it("never prompts an App Store subscriber or lifetime Plus", () => {
    expect(plusPrompt(access({ isPlus: true, plusUntil: until(DAY), storeSubscription: true }), PLANS, NOW, NONE)).toBeNull();
    expect(plusPrompt(access({ isPlus: true, plusUntil: until(DAY), storeSubscription: null }), PLANS, NOW, NONE)).toBeNull();
    expect(plusPrompt(access({ isPlus: true, plusUntil: null, storeSubscription: false }), PLANS, NOW, NONE)).toBeNull();
  });

  it("keys a dismissed renew prompt by its end date, so a later pass prompts again", () => {
    const soon = prepaid(DAY);
    const dismissed = dismissPlusPrompt(NONE, "renew", soon, NOW);
    expect(plusPrompt(soon, PLANS, NOW, dismissed)).toBeNull();
    expect(plusPrompt(prepaid(2 * DAY), PLANS, NOW, dismissed)).toBe("renew");
    // Dismissing the renew prompt leaves the offer's state alone, and the reverse.
    expect(dismissed.offerAt).toBeNull();
    expect(dismissPlusPrompt(dismissed, "offer", FREE, NOW).renewKey).toBe(dismissed.renewKey);
  });

  it("candidate needs no plans, so only a possible prompt reads them", () => {
    expect(plusPromptCandidate(FREE, NOW, NONE)).toBe("offer");
    expect(plusPromptCandidate(prepaid(DAY), NOW, NONE)).toBe("renew");
    expect(plusPromptCandidate(prepaid(30 * DAY), NOW, NONE)).toBeNull();
  });
});

describe("stored dismissal", () => {
  it("round-trips and never holds the date itself", () => {
    const dismissal = dismissPlusPrompt(dismissPlusPrompt(NONE, "offer", FREE, NOW), "renew", prepaid(DAY), NOW);
    const raw = encodePlusPromptDismissal(dismissal);
    expect(decodePlusPromptDismissal(raw)).toEqual(dismissal);
    expect(raw).not.toContain("2026");
    expect(plusEndKey(until(DAY))).toBe(dismissal.renewKey);
  });

  it("reads anything missing or damaged as nothing dismissed", () => {
    for (const raw of [null, "", "{", "[]", "null", '{"offerAt":"x","renewKey":3}']) expect(decodePlusPromptDismissal(raw)).toEqual(NONE);
  });
});
