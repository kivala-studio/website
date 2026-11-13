import { describe, expect, it } from "vitest";

import type { InformationSignificance } from "../intelligence/models";
import {
  ContentExposureStore,
  EXPOSURE_PREFIX,
  EXPOSURE_RETENTION_MS,
  type PersonalisationAggregate,
  type PersonalizationCandidate,
  type PersonalizationContext,
  type PersonalizationSurface,
  STANDARD_CONFIGURATION,
  SIGNIFICANCE_ONLY_CONFIGURATION,
  type UserInterestProfile,
  behavioralInterest,
  evaluatePersonalization,
  evaluateNotification,
  explanation,
  exposureSnapshot,
  feedbackAdjustment,
  feedbackFor,
  interestProfile,
  memoryStorage,
  personalizationContext,
  relationshipWeight,
} from ".";

// Ports `PersonalizationEngineTests`.

const now = Date.parse("2026-09-26T11:00:00+01:00");
const set = (...values: string[]) => new Set(values);

function fact(id: string, significance: InformationSignificance = "significant", marketWide = false): PersonalizationCandidate {
  return {
    id,
    factKeys: set(`fact:${id}`),
    topicKeys: set(`topic:${id}`),
    assets: set(id),
    issuers: set(`issuer:${id}`),
    family: id,
    category: "market",
    observedAt: now - 3_600_000,
    expiresAt: now + 300_000,
    significance,
    isMarketWide: marketWide,
  };
}

function replacing(
  value: PersonalizationCandidate,
  changes: { keys?: Set<string>; topics?: Set<string>; assets?: Set<string>; issuers?: Set<string> },
): PersonalizationCandidate {
  return {
    id: value.id,
    factKeys: changes.keys ?? value.factKeys,
    topicKeys: changes.topics ?? value.topicKeys,
    assets: changes.assets ?? value.assets,
    issuers: changes.issuers ?? value.issuers,
    family: value.family,
    category: value.category,
    observedAt: value.observedAt,
    expiresAt: value.expiresAt,
    significance: value.significance,
  };
}

function rank(
  facts: PersonalizationCandidate[],
  options: { surface?: PersonalizationSurface; profile?: UserInterestProfile; exposure?: ReturnType<typeof exposureSnapshot>; limit?: number } = {},
) {
  return evaluatePersonalization(
    facts,
    personalizationContext({
      surface: options.surface ?? "activityCenter",
      now,
      profile: options.profile ?? interestProfile(),
      exposure: options.exposure ?? exposureSnapshot(),
      marketState: "weekend",
    }),
    options.limit ?? 5,
  );
}

const ids = (decisions: readonly { candidate: PersonalizationCandidate }[]) => decisions.map((d) => d.candidate.id);

describe("PersonalizationEngine", () => {
  it("keeps feedback narrow and never changes significance or relationships", () => {
    const bai = fact("BAI");
    const other: PersonalizationCandidate = {
      ...replacing(fact("other"), { assets: set("BAI") }),
      topicKeys: bai.topicKeys,
      issuers: bai.issuers,
      family: bai.family,
    };
    const feedback = feedbackFor(bai, "fact", "watchlist", now);
    const result = rank([bai, other], { profile: interestProfile({ holdingIDs: set("BAI") }), exposure: exposureSnapshot({ feedback: [feedback] }) });
    expect(result.selected[0].candidate.id).toBe("other");
    expect(result.decisions.find((d) => d.candidate.id === "BAI")?.score?.feedback).toBe(-12);
    expect(result.decisions.every((d) => d.score?.relationship === 80 && d.candidate.significance === "significant")).toBe(true);
    expect(result.decisions.find((d) => d.candidate.id === "other")?.score?.feedback).toBe(0);
  });

  it("scopes family feedback to its surface, bounds it and decays it", () => {
    const bai = fact("BAI");
    const record = feedbackFor(bai, "familyOnSurface", "watchlist", now);
    expect(feedbackAdjustment(bai, "watchlist", [record, record], now)).toBe(-16);
    expect(feedbackAdjustment(bai, "home", [record], now)).toBe(0);
    expect(feedbackAdjustment(fact("BFA"), "watchlist", [record], now)).toBe(0);
    expect(feedbackAdjustment(bai, "watchlist", [record], now + 28 * 86_400_000)).toBe(-8);
    expect(feedbackAdjustment(bai, "watchlist", [record], now + EXPOSURE_RETENTION_MS)).toBe(0);
  });

  it("cannot penalise material, mandatory, private or fallback content", () => {
    let bai = fact("BAI");
    const record = feedbackFor(bai, "fact", "activityCenter", now);
    let context: PersonalizationContext = personalizationContext({ surface: "activityCenter", now, exposure: exposureSnapshot({ feedback: [record] }) });
    const feedback = (candidate: PersonalizationCandidate, configuration = STANDARD_CONFIGURATION) =>
      evaluatePersonalization([candidate], context, 1, configuration).selected[0]?.score?.feedback;
    expect(feedback(bai)).toBe(-12);
    context = { ...context, hidesPersonalValues: true };
    expect(feedback(bai)).toBe(0);
    context = { ...context, hidesPersonalValues: false };
    expect(feedback(bai, SIGNIFICANCE_ONLY_CONFIGURATION)).toBe(0);
    bai = { ...bai, isMandatory: true };
    expect(feedback(bai)).toBe(0);
    expect(feedback(fact("BAI", "material"))).toBe(0);
  });

  it("persists feedback with undo, account isolation and no late writes after deletion", () => {
    const storage = memoryStorage();
    const user = "user-1";
    const store = new ContentExposureStore(storage);
    const bai = fact("BAI");
    const record = feedbackFor(bai, "familyOnSurface", "watchlist", now);
    store.recordFeedback(record, user, now);
    store.recordFeedback(record, user, now);
    expect(new ContentExposureStore(storage).snapshot(user, now).feedback).toEqual([record]);
    expect(store.snapshot("user-2", now).feedback).toEqual([]);
    store.removeFeedback(bai, "watchlist", user, now);
    expect(store.snapshot(user, now).feedback).toEqual([]);
    store.recordFeedback(record, user, now);
    store.resetFeedback(user, now);
    expect(store.snapshot(user, now).feedback).toEqual([]);
    store.remove(user);
    store.recordFeedback(record, user, now);
    expect(store.snapshot(user, now).feedback).toEqual([]);
    expect(storage.values.has(EXPOSURE_PREFIX + user)).toBe(false);
  });

  it("keeps novelty receipts and the reset cutoff from an archive written before feedback", () => {
    const storage = memoryStorage();
    const user = "user-1";
    storage.setItem(
      EXPOSURE_PREFIX + user,
      JSON.stringify({
        shown: { "old-fact": now },
        opened: { "old-fact": now },
        topics: { "old-topic": now },
        homeShown: { "old-fact": now },
        behaviorSince: now,
        measurements: {},
      }),
    );
    const store = new ContentExposureStore(storage);
    const restored = store.snapshot(user, now);
    expect(restored.opened).toEqual(set("old-fact"));
    expect(restored.topics).toEqual(set("old-topic"));
    expect(restored.feedback).toEqual([]);
    expect(store.behaviorSince(user, now)).toBe(now);
  });

  it("lets holdings, watchlist and alerts outweigh behaviour without changing significance", () => {
    const profile = interestProfile({ holdingIDs: set("BAI"), watchedIDs: set("ENSA"), alertIDs: set("BFA"), behavior: new Map([["UNITEL", 999]]) });
    const result = rank([fact("UNITEL"), fact("BFA"), fact("ENSA"), fact("BAI")], { profile });
    expect(ids(result.selected)).toEqual(["BAI", "ENSA", "BFA", "UNITEL"]);
    expect(result.selected.at(-1)?.score?.interest).toBe(STANDARD_CONFIGURATION.maximumBehaviorWeight);
    expect(result.selected.every((d) => d.candidate.significance === "significant")).toBe(true);
  });

  it("puts the portfolio fact first and rejects a tiny, frequently viewed movement", () => {
    const portfolio = { ...fact("BAI", "noteworthy"), isMandatory: true };
    const profile = interestProfile({ holdingIDs: set("BAI"), watchedIDs: set("UNITEL", "ENSA"), behavior: new Map([["UNITEL", 8]]) });
    const result = rank([portfolio, fact("UNITEL", "routine"), fact("ENSA", "material"), fact("market-event", "critical", true)], {
      surface: "saturdayDiscover",
      profile,
    });
    expect(result.selected[0].candidate.id).toBe("BAI");
    expect(result.selected.some((d) => d.candidate.id === "market-event")).toBe(true);
    expect(result.decisions.find((d) => d.candidate.id === "UNITEL")?.rejection).toBe("insufficient-significance");
  });

  it("caps daily signals, decays behaviour and keeps explicit relationships", () => {
    const user = "user-1";
    const row = (day: string, count: number): PersonalisationAggregate => ({
      userID: user,
      installationID: "installation",
      activityDay: day,
      kind: "asset_view",
      securityID: "BAI",
      relatedSecurityID: null,
      variant: "",
      activityCount: count,
    });
    const recent = behavioralInterest([row("2026-09-26", 1000)], user, now);
    const older = behavioralInterest([row("2026-08-29", 1000)], user, now);
    expect(older.get("BAI") ?? 0).toBeCloseTo((recent.get("BAI") ?? 0) / 2, 4);
    expect(recent.get("BAI") ?? 0).toBeLessThanOrEqual(3);
    const stale = behavioralInterest([row("2026-03-26", 1000)], user, now);
    expect(stale.size).toBe(0);
    const profile = interestProfile({ holdingIDs: set("BAI"), watchedIDs: set("ENSA"), behavior: stale });
    expect(relationshipWeight(profile, set("BAI"))).toBe(80);
    expect(relationshipWeight(profile, set("ENSA"))).toBe(40);
    expect(behavioralInterest([row("2026-09-26", 2)], "user-2", now).size).toBe(0);
  });

  it("uses domain keys for novelty across surfaces and lets related facts coexist", () => {
    let first = replacing(fact("one"), { keys: set("price:BAI:week") });
    const second = replacing(fact("two"), { keys: set("price:BAI:week") });
    expect(rank([first, second]).selected).toHaveLength(1);
    expect(rank([second], { surface: "saturdayDiscover", exposure: exposureSnapshot({ opened: set("price:BAI:week") }) }).decisions[0].rejection).toBe(
      "already-opened",
    );
    const related = replacing(fact("allocation"), { topics: first.topicKeys as Set<string> });
    expect(rank([first, related]).selected).toHaveLength(2);
    expect(rank([first], { exposure: exposureSnapshot({ shown: first.factKeys }) }).selected[0].score!.novelty).toBeLessThan(0);
    first = { ...first, isMandatory: true };
    expect(rank([first], { surface: "saturdayDiscover", exposure: exposureSnapshot({ homeShown: first.factKeys }) }).decisions[0].rejection).toBe(
      "shown-on-home",
    );
  });

  it("cannot leak duplicates through transitive aliases", () => {
    const a = replacing(fact("a"), { keys: set("source", "article-a") });
    const b = replacing(fact("b"), { keys: set("source", "event") });
    const c = replacing(fact("c"), { keys: set("event", "article-c") });
    expect(rank([c, a, b]).selected).toHaveLength(1);
    expect(rank([c, a, b], { surface: "saturdayDiscover", exposure: exposureSnapshot({ opened: set("article-a") }) }).selected).toHaveLength(0);
  });

  it("keeps Discover diverse with one controlled exploration", () => {
    const profile = interestProfile({ holdingIDs: set("BAI", "UNITEL", "ENSA", "BFA") });
    const candidates = [fact("BAI"), fact("UNITEL"), fact("ENSA"), fact("BFA"), fact("outside", "material")];
    const result = rank(candidates, { surface: "saturdayDiscover", profile, limit: 3 });
    expect(result.selected.some((d) => d.candidate.id === "outside" && d.selectionReason === "market-exploration")).toBe(true);
    const similar = Array.from({ length: 8 }, (_, i) => replacing(fact(`item${i}`), { assets: set("BAI"), issuers: set("issuer-BAI") }));
    expect(rank(similar, { surface: "saturdayDiscover", profile }).selected).toHaveLength(2);
    expect(rank(similar, { surface: "saturdayDiscover", profile }).decisions.some((d) => d.rejection === "diversity-limit")).toBe(true);
    expect(rank([fact("noise", "routine")], { surface: "saturdayDiscover" }).selected).toHaveLength(0);
  });

  it("gives surfaces different attention costs and keeps mandatory performance", () => {
    const value = fact("BAI", "noteworthy");
    expect(rank([value], { surface: "saturdayDiscover" }).selected).toHaveLength(1);
    expect(rank([value], { surface: "home" }).selected).toHaveLength(0);
    expect(rank([value], { surface: "activityCenter" }).selected).toHaveLength(1);
    expect(rank([value], { surface: "notification", profile: interestProfile({ holdingIDs: set("BAI") }) }).selected).toHaveLength(0);
    const core = { ...fact("BAI", "routine"), isMandatory: true };
    expect(
      rank([core], { surface: "portfolio", profile: interestProfile({ holdingIDs: set("BAI") }), exposure: exposureSnapshot({ opened: core.factKeys }) })
        .selected,
    ).toHaveLength(1);
  });

  it("requires explicit relevance, significance and novelty for notifications", () => {
    const material = fact("UNITEL", "material");
    expect(rank([material], { surface: "notification", profile: interestProfile({ watchedIDs: set("UNITEL") }) }).selected).toHaveLength(1);
    expect(rank([material], { surface: "notification", profile: interestProfile({ behavior: new Map([["UNITEL", 8]]) }) }).selected).toHaveLength(0);
    expect(
      rank([fact("UNITEL", "routine")], {
        surface: "notification",
        profile: interestProfile({ watchedIDs: set("UNITEL"), behavior: new Map([["UNITEL", 8]]) }),
      }).selected,
    ).toHaveLength(0);
    expect(
      rank([material], {
        surface: "notification",
        profile: interestProfile({ watchedIDs: set("UNITEL") }),
        exposure: exposureSnapshot({ shown: material.factKeys }),
      }).selected,
    ).toHaveLength(0);
  });

  it("handles cold start, stable ties, missing data, expiry and market state", () => {
    expect(ids(rank([fact("b"), fact("a")]).selected)).toEqual(["a", "b"]);
    expect(rank([]).selected).toHaveLength(0);
    expect(rank([{ ...fact("missing"), rejection: "unverified-stale-or-unrelated" }]).selected).toHaveLength(0);
    const expired: PersonalizationCandidate = {
      id: "expired",
      factKeys: set("expired"),
      topicKeys: set(),
      assets: set(),
      issuers: set(),
      family: "price",
      category: "market",
      observedAt: now - 60_000,
      expiresAt: now,
      significance: "material",
    };
    expect(rank([expired]).decisions[0].rejection).toBe("expired");
    const open = evaluatePersonalization([fact("a")], personalizationContext({ surface: "saturdayDiscover", now, marketState: "open" }), 5);
    expect(open.decisions[0].rejection).toBe("not-saturday-closed");
    expect(explanation(rank([fact("a")]))).toContain("significance=");
  });

  it("isolates accounts, keeps receipts 56 days, resets behaviour from tomorrow and ignores writes after deletion", () => {
    const storage = memoryStorage();
    const user = "user-1";
    const store = new ContentExposureStore(storage);
    store.record({ keys: set("article"), opened: false, surface: "home", userID: user, now });
    expect(store.snapshot("user-2", now).shown.size).toBe(0);
    store.resetBehavior(user, now);
    expect(store.behaviorSince(user, now)).toBe(Date.parse("2026-09-27T00:00:00+01:00"));
    const persisted = new ContentExposureStore(storage);
    expect(persisted.snapshot(user, now).shown.has("article")).toBe(true);
    expect(persisted.snapshot(user, now + EXPOSURE_RETENTION_MS).shown.size).toBe(0);
    store.remove(user);
    store.record({ keys: set("late-write"), opened: true, surface: "home", userID: user, now });
    store.resetBehavior(user, now);
    expect(store.behaviorSince(user, now)).toBeNull();
    expect(storage.values.has(EXPOSURE_PREFIX + user)).toBe(false);
  });

  it("invalidates the ranking cache for expiry, profile, exposure and market state", () => {
    const facts = [fact("BAI")];
    let context = personalizationContext({ surface: "saturdayDiscover", now, marketState: "weekend" });
    expect(evaluatePersonalization(facts, context, 5).selected).toHaveLength(1);
    context = { ...context, exposure: exposureSnapshot({ opened: facts[0].factKeys }) };
    expect(evaluatePersonalization(facts, context, 5).selected).toHaveLength(0);
    context = { ...context, exposure: exposureSnapshot(), marketState: "open" };
    expect(evaluatePersonalization(facts, context, 5).selected).toHaveLength(0);
    context = { ...context, marketState: "weekend", now: facts[0].expiresAt };
    expect(evaluatePersonalization(facts, context, 5).selected).toHaveLength(0);
    context = { ...context, now, profile: interestProfile({ holdingIDs: set("BAI") }) };
    expect(evaluatePersonalization(facts, context, 5).selected[0].score?.relationship).toBe(80);
    const aged: PersonalizationCandidate = {
      id: "recency-boundary",
      factKeys: set("recency-boundary"),
      topicKeys: set(),
      assets: set(),
      issuers: set(),
      family: "market",
      category: "market",
      observedAt: now - 86_400_000,
      expiresAt: now + 300_000,
      significance: "material",
    };
    context = { ...context, surface: "activityCenter", now: now - 1000 };
    expect(evaluatePersonalization([aged], context, 1).selected[0].score?.recency).toBe(12);
    context = { ...context, now };
    expect(evaluatePersonalization([aged], context, 1).selected[0].score?.recency).toBe(8);
  });

  it("cannot invent or replay a server notification qualification after expiry", () => {
    const source = {
      version: 1,
      kind: "verified_movement" as const,
      factKey: "notification:automatic_movement:event:verified",
      checkedAt: "2026-09-26T10:00:00Z",
      expiresAt: "2026-09-26T10:02:00Z",
    };
    expect(evaluateNotification(source, "BAI", exposureSnapshot(), now).selected).toHaveLength(1);
    expect(evaluateNotification(source, null, exposureSnapshot(), now).selected).toHaveLength(0);
    expect(evaluateNotification(source, "BAI", exposureSnapshot({ shown: set(source.factKey) }), now).selected).toHaveLength(0);
    expect(evaluateNotification(source, "BAI", exposureSnapshot(), now + 120_000).selected).toHaveLength(0);
  });
});
