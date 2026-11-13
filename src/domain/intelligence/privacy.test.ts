import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import pt from "../../../messages/pt.json";
import { activityText } from "../activity/copy";
import { createFormat, type Translate } from "../format";
import { EMPTY_ARCHIVE, insightItems, localActivityRows, mergeArchive } from "./activity";
import { Dec } from "./math";
import type { Insight } from "./models";
import { type PrivacySurface, allows, isPubliclyShareable, privacyClassification } from "./privacy";
import { type WeeklyWrap, type WeeklyWrapMove, type WeeklyWrapPortfolio, presentationInsights, presentationStories, wrapPeriod } from "./weekly-wrap";

/* Port of Tests/MarketDiscoveryTests/IntelligencePrivacyTests.swift. Share cards, the summary projection and video
 * export are W15; widgets and the app-switcher cover do not exist on the web. */

const move: WeeklyWrapMove = {
  securityID: "public-BAI",
  symbol: "BAI",
  currencyCode: "AOA",
  start: new Dec(100),
  end: new Dec("103.2"),
  percentage: new Dec("3.2"),
  firstDate: 0,
  lastDate: 0,
  points: [],
};
const portfolio: WeeklyWrapPortfolio = {
  startValue: new Dec(3628000),
  endValue: new Dec(3200000),
  change: new Dec(-428000),
  percentage: new Dec("-11.8"),
  firstDate: 0,
  lastDate: 0,
  leadingSymbol: "PRIVATE",
  leadingContribution: new Dec(-428000),
  holdingCount: 3,
};
const wrap: WeeklyWrap = {
  period: wrapPeriod(0, Date.now()),
  stories: [
    { kind: "opening" },
    { kind: "marketRise", move },
    { kind: "watchlistHighlight", move },
    { kind: "watchlist", breadth: { rises: 1, falls: 0, unchanged: 0 }, total: 7 },
    { kind: "portfolio", portfolio },
    { kind: "portfolioContributor", portfolio },
    { kind: "personalStat", stat: { kind: "mostViewed", symbol: "PRIVATE", views: 250 } },
    { kind: "summary" },
  ],
  watchedCount: 7,
  indexChange: null,
  watchedHighlight: move,
  portfolio,
};

const now = Date.now();
const performance: Insight = {
  id: "private-performance",
  type: "portfolioPricePerformance",
  category: "market",
  fact: {
    kind: "portfolioPerformance",
    value: {
      startValue: new Dec(3628000),
      endValue: new Dec(3200000),
      change: new Dec(-428000),
      percentage: new Dec("-11.8"),
      firstObservedAt: now - 7 * 86_400_000,
      lastObservedAt: now - 3_600_000,
      positions: [],
      advancing: 0,
      declining: 1,
      unchanged: 0,
    },
  },
  generatedAt: now,
  period: { start: now - 7 * 86_400_000, endExclusive: now },
  expiresAt: now + 3_600_000,
  relatedAssetIDs: [],
  relevance: { isHeld: false, isWatched: false, activityRank: null },
  destination: { kind: "portfolio" },
  provenance: {
    calculationID: "portfolio",
    calculationVersion: 1,
    calendarVersion: "fixture",
    observations: [],
    fetchedAt: now,
    completeness: "completeExpectedSessions",
  },
};

describe("intelligence privacy", () => {
  it("denies sensitive data at external boundaries without consent, and privacy mode overrides consent", () => {
    for (const surface of ["notificationPreview", "widget", "wrapShare", "appSnapshot"] as PrivacySurface[]) {
      expect(allows({ surface }, "privateFinancial")).toBe(false);
      const optedInButHidden = { surface, privacyEnabled: true, authorizesPersonalContext: true, authorizesFinancial: true };
      expect(allows(optedInButHidden, "privateFinancial")).toBe(false);
      expect(allows(optedInButHidden, "personalContext")).toBe(false);
    }
    expect(allows({ surface: "inApp", privacyEnabled: true }, "publicMarket")).toBe(true);
    expect(allows({ surface: "inApp", privacyEnabled: true }, "personalContext")).toBe(false);
    expect(allows({ surface: "inApp" }, "privateFinancial")).toBe(true);
  });

  it("removes every personal chapter from playback without mutating the saved wrap", () => {
    expect(presentationStories(wrap, true).map((story) => story.kind)).toEqual(["opening", "marketRise", "summary"]);
    expect(presentationStories(wrap, false)).toHaveLength(wrap.stories.length);
    expect(wrap.portfolio?.endValue.toString()).toBe("3200000");
    expect(wrap.watchedCount).toBe(7);
    expect(presentationInsights({ ...wrap, verifiedInsights: [performance] }, true)).toEqual([]);
  });

  it("classifies by the financial payload and the Activity centre hides it", () => {
    expect(privacyClassification(performance)).toBe("privateFinancial");
    expect(isPubliclyShareable(performance)).toBe(false);
    const portfolioInsight = {
      ...performance,
      category: "portfolio" as const,
      relatedAssetIDs: ["asset"],
      provenance: { ...performance.provenance, calculationID: "portfolio" },
    };
    const archive = mergeArchive(
      EMPTY_ARCHIVE,
      insightItems([portfolioInsight], new Set(), now, { rank: (insights) => insights, receiptKeys: () => [] }),
      [{ ...portfolioInsight, serverNotificationID: "frozen" }],
      now,
    );
    const rows = localActivityRows(archive, { watchedIDs: null, portfolioTransactions: null }, now, () => ({
      title: "A carteira desceu 11,8%",
      body: "-428000 Kz",
    }));
    expect(rows).toHaveLength(1);
    const t = createTranslator({ locale: "pt", messages: pt });
    const translate: Translate = (key, values) => t(key as never, values as never);
    const hidden = activityText(rows[0], { t: translate, format: createFormat("pt", translate), symbolOf: () => undefined, privacyMode: true });
    expect(hidden.title).not.toContain("11");
    expect(hidden.title).not.toContain("carteira");
    expect(hidden.body).not.toContain("428000");
  });
});
