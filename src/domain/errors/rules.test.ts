// Contract behaviour beyond the iOS tests: P0001 rules, contract SQLSTATEs, retry hints, catalogue keys.
import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import pt from "../../../messages/pt.json";
import {
  AppError,
  ERROR_MESSAGE_KEYS,
  HttpError,
  mapError,
  postgrestCode,
  retryAfterSeconds,
  serverRule,
  type AppErrorCategory,
} from "./index";

const rule = (message: string, details: unknown = null) => ({ code: "P0001", message, details, hint: null });

describe("server rules", () => {
  it("map P0001 messages to typed, non-retryable rules", () => {
    const cases = [
      [rule("FREE_WATCHLIST_LIMIT", '{"feature":"watchlist","limit":3}'), { feature: "watchlist", limit: 3, upgrade: { reason: "watchlist", tier: "plus" }, messageKey: "market.watchlist.freePlanLimit" }],
      [rule("FREE_MOVEMENT_LIMIT", { feature: "movement_alerts", limit: 1 }), { limit: 1, upgrade: { reason: "movement", tier: "plus" }, messageKey: "alerts.error.freePlanLimit" }],
      [rule("PLUS_REQUIRED", '{"feature":"portfolios"}'), { upgrade: { reason: "portfolios", tier: "plus" }, messageKey: "subscriptions.paywall.portfoliosReason" }],
      [rule("PLUS_REQUIRED", '{"feature":"alert_rules","limit":2}'), { limit: 2, upgrade: { reason: "alerts", tier: "plus" } }],
      [rule("PLUS_REQUIRED", '{"feature":"toString"}'), { upgrade: { reason: "onboarding", tier: "plus" } }],
      [rule("PRO_REQUIRED", '{"feature":"clientViews"}'), { upgrade: { reason: "clientViews", tier: "pro" }, messageKey: null }],
      [rule("SHARE_LIMIT", '{"limit":20}'), { limit: 20, upgrade: null, messageKey: "portfolioShare.limit" }],
      [rule("WATCHLIST_GROUP_LIMIT", "not json"), { feature: null, limit: null, upgrade: null, messageKey: "site.watchlist.groupLimit" }],
      [rule("FREE_COMPARISON_WEEK_LIMIT"), { upgrade: { reason: "comparison", tier: "plus" }, messageKey: "subscriptions.access.weeklyPairLimit" }],
      [rule("REFERRAL_OWN_CODE"), { upgrade: null, messageKey: "referral.error.own" }],
    ] as const;
    for (const [source, expected] of cases) {
      const error = mapError(source, "watchlist.add")!;
      expect(error.category).toBe("validation");
      expect(error.userCanRetry).toBe(false);
      expect(error.rule).toMatchObject({ code: source.message, ...expected });
      expect(serverRule(new AppError("unknown", { cause: source }))?.code).toBe(source.message);
    }
    expect(mapError(rule("SOMETHING_NEW"), "x")?.rule).toBeNull();
    expect(mapError({ code: "23514", message: "FREE_WATCHLIST_LIMIT", details: null, hint: null }, "x")?.rule).toBeNull();
  });

  it("follow the contract for SQLSTATEs iOS leaves as server errors", () => {
    const cases: [string, AppErrorCategory][] = [
      ["28000", "unauthenticated"],
      ["PT409", "validation"],
      ["22023", "validation"],
      ["22007", "validation"],
      ["57014", "timeout"],
    ];
    for (const [code, category] of cases) {
      expect(mapError({ code, message: "private", details: null, hint: null }, "x")?.category).toBe(category);
    }
    expect(postgrestCode(mapError({ code: "PT409", message: "", details: null, hint: null }, "x"))).toBe("PT409");
  });

  it("read retry_after_seconds from HTTP bodies only", () => {
    expect(retryAfterSeconds(mapError(new HttpError(503, '{"retry_after_seconds":30}'), "x"))).toBe(30);
    expect(retryAfterSeconds(new HttpError(503, { retry_after_seconds: 0 }))).toBeNull();
    expect(retryAfterSeconds(new HttpError(503, "<html>"))).toBeNull();
  });

  it("reference catalogue keys that exist in pt and en", () => {
    const has = (tree: unknown, key: string) =>
      typeof key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], tree) === "string";
    expect(ERROR_MESSAGE_KEYS.filter((key) => !has(pt, key) || !has(en, key))).toEqual([]);
  });
});
