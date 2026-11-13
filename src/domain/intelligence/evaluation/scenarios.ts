import type Decimal from "decimal.js";

import { type CalendarException, MarketCalendar, type MarketState } from "../../market/calendar";
import type { PriceObservation } from "../../market/history-validation";
import { VALID_QUALITY } from "../../market/quality";
import type { EpochMs } from "../../market/zone";
import type { NotificationQualification } from "../../personalisation/notification";
import { type ContentExposureSnapshot, exposureSnapshot } from "../../personalisation/candidate";
import { type PersonalizationConfiguration, SIGNIFICANCE_ONLY_CONFIGURATION, STANDARD_CONFIGURATION } from "../../personalisation/configuration";
import { type UserInterestProfile, interestProfile } from "../../personalisation/profile";
import type { PortfolioTransaction } from "../../portfolio/models";
import type { MarketEvent } from "../../week-ahead/week-ahead";
import type { InsightInput } from "../engine";
import type { IntelligenceFeature } from "../feature-controls";
import { Dec } from "../math";
import type { PortfolioInsightInput, WatchlistPublication } from "../models";

/*
 * iOS `IntelligenceEvaluationScenario` and `IntelligenceEvaluationLibrary` (test target): evaluation fixtures only,
 * never a production segmentation or persona model.
 */

export type Severity = "hard" | "quality";
export type Rule =
  | "noFinancialInsights"
  | "noWeeklyPerformance"
  | "noNotifications"
  | "noEvents"
  | "heldEventFirst"
  | "discoverDiversity"
  | "consumedSuppressed"
  | "usefulContent"
  | "portfolioNearTop"
  | "notificationsPresent"
  | "concentrationDisclosed"
  | "allHoldingsRepresented"
  | "watchlistRelevant";

export interface Expectation {
  readonly name: string;
  readonly severity: Severity;
  readonly rule: Rule;
}

/** The personalisation snapshot a scenario feeds the Weekly Wrap (iOS `PersonalisationSnapshot`). */
export interface ActivitySnapshot {
  readonly uniqueAssetsViewed: number;
  readonly mostViewedAssetID: string | null;
  readonly mostViewedCount: number;
  readonly mostViewedDays: number;
  readonly relevantAssetIDs: readonly string[];
  readonly interestProfile: UserInterestProfile;
}

export interface EvaluationScenario {
  readonly id: string;
  input: InsightInput;
  marketState: MarketState;
  profile: UserInterestProfile;
  activitySnapshot: ActivitySnapshot | null;
  exposure: ContentExposureSnapshot;
  events: MarketEvent[];
  qualifications: [NotificationQualification, string | null][];
  disabledFeatures: Set<IntelligenceFeature>;
  configuration: PersonalizationConfiguration;
  consumedStrongest: boolean;
  repeatCandidates: boolean;
  expectations: Expectation[];
}

const HOUR = 3_600_000;
const iso = (value: string): EpochMs => Date.parse(value);
const isoText = (value: EpochMs) => new Date(value).toISOString().replace(".000Z", "Z");
/** Luanda midnight of 2026-09-`number`. */
export const day = (number: number): EpochMs => iso(`2026-09-${String(number).padStart(2, "0")}T00:00:00+01:00`);

export interface ScenarioOptions {
  readonly holdings?: Readonly<Record<string, number>>;
  readonly watched?: readonly string[];
  readonly behavior?: Readonly<Record<string, number>>;
  readonly quiet?: boolean;
  readonly incomplete?: boolean;
  readonly stale?: boolean;
  readonly holiday?: boolean;
  readonly sunday?: boolean;
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function scenario(id: string, options: ScenarioOptions = {}): EvaluationScenario {
  const { holdings = {}, watched = [], behavior = {}, quiet = false, incomplete = false, stale = false, holiday = false, sunday = false } = options;
  const now = day(sunday ? 27 : 26) + 10 * HOUR;
  const fetched = now + (stale ? -1_800_000 : -60_000);
  const ids = ["A", "B", "C", "D"];
  const changes: Record<string, Decimal> = quiet
    ? { A: new Dec(0), B: new Dec(0), C: new Dec(0), D: new Dec(0) }
    : { A: new Dec(8), B: new Dec(-6), C: new Dec("0.1"), D: new Dec(12) };
  const exceptions: [EpochMs, CalendarException][] = holiday ? [[day(23), { kind: "holiday" }]] : [];
  const calendar = new MarketCalendar({
    version: "evaluation-calendar-v1",
    coverage: { start: day(16), endExclusive: iso("2026-10-06T00:00:00+01:00") },
    verifiedAt: fetched,
    validUntil: now + 600_000,
    normalHours: { openingMinute: 9 * 60, closingMinute: 15 * 60 + 30 },
    exceptions: new Map(exceptions),
    regularWeekdays: new Set([2, 3, 4, 5, 6]),
  });
  const rows: PriceObservation[] = ids.flatMap((asset) =>
    [18, 21, 22, 23, 24, 25].flatMap((number, index): PriceObservation[] => {
      if (holiday && number === 23) return [];
      if (incomplete && number === 24) return [];
      const close = day(number) + 15.5 * HOUR;
      return [
        {
          recordID: `${asset}-${number}`,
          assetID: asset,
          currencyCode: "AOA",
          price: new Dec(100).plus(changes[asset].times(index).div(5)),
          observedAt: close,
          collectedAt: close + 60_000,
          source: { dataset: "evaluation.close", ingestionRunID: `fixture-${number}`, contentHash: "a".repeat(64), parserVersion: "fixture-v1" },
          isFinal: true,
          dataQuality: VALID_QUALITY,
        },
      ];
    }),
  );
  const held = Object.keys(holdings).sort(byText);
  const transactions: PortfolioTransaction[] = held.map((asset) => ({
    id: `buy-${asset}`,
    securityId: asset,
    kind: "buy",
    quantity: new Dec(holdings[asset]),
    unitPrice: new Dec(100),
    fees: new Dec(0),
    tradedOn: "2026-09-16",
    createdAt: isoText(day(16)),
  }));
  const portfolio: PortfolioInsightInput | null =
    held.length === 0
      ? null
      : {
          week: { start: day(21), endExclusive: day(26) },
          transactions,
          securities: held.map((asset) => ({
            assetID: asset,
            symbol: asset,
            currencyCode: "AOA",
            supportsUnitValuation: true,
            issuerID: `issuer-${asset}`,
            issuerName: `Emitente ${asset}`,
            sector: asset === "A" ? "Banca" : "Indústria",
          })),
          ledgerFetchedAt: fetched,
          metadataFetchedAt: fetched,
        };
  const articles: WatchlistPublication[] =
    quiet || stale || incomplete
      ? []
      : [1, 2, 3].map((number) => ({
          articleID: `00000000-0000-0000-0000-${String(number).padStart(12, "0")}`,
          title: `Comunicado de avaliação ${number}`,
          publishedAt: now - HOUR,
          assetIDs: number === 1 ? ["A"] : [],
          primarySourceURL: `https://example.org/notice/${number}`,
          sourceName: "Fonte de avaliação",
        }));
  const result: EvaluationScenario = {
    id,
    input: {
      period: { start: day(18), endExclusive: day(26) },
      generatedAt: now,
      fetchedAt: fetched,
      calendar,
      observations: rows,
      watchlistIDs: new Set(watched),
      portfolioIDs: new Set(held),
      activityAssetIDs: Object.keys(behavior).sort(byText),
      portfolio,
      publications: articles.length === 0 ? null : { period: { start: now - 7 * 86_400_000, endExclusive: now }, fetchedAt: fetched, articles },
    },
    marketState: "weekend",
    profile: interestProfile({ holdingIDs: new Set(held), watchedIDs: new Set(watched), behavior: new Map(Object.entries(behavior)) }),
    activitySnapshot: null,
    exposure: exposureSnapshot(),
    events: [],
    qualifications: [],
    disabledFeatures: new Set(),
    configuration: STANDARD_CONFIGURATION,
    consumedStrongest: false,
    repeatCandidates: false,
    expectations: [],
  };
  if (stale) result.expectations.push({ name: "Unsafe financial evidence fails closed", severity: "hard", rule: "noFinancialInsights" });
  if (incomplete) result.expectations.push({ name: "Incomplete series cannot produce Weekly Performance", severity: "hard", rule: "noWeeklyPerformance" });
  if (quiet) result.expectations.push({ name: "Quiet week does not interrupt", severity: "hard", rule: "noNotifications" });
  return result;
}

function qualification(factKey: string, checkedAt: EpochMs, expiresAt: EpochMs): NotificationQualification {
  return { version: 1, kind: "verified_movement", factKey, checkedAt: isoText(checkedAt), expiresAt: isoText(expiresAt) };
}

export function allScenarios(): EvaluationScenario[] {
  const newUser = scenario("new-user");
  newUser.expectations = [{ name: "New user receives useful market content", severity: "quality", rule: "usefulContent" }];
  const portfolio = scenario("portfolio-only", { holdings: { A: 4 } });
  portfolio.expectations = [{ name: "Significant portfolio information near top", severity: "quality", rule: "portfolioNearTop" }];
  const engaged = scenario("engaged-user", { holdings: { A: 4 }, watched: ["B", "D"], behavior: { C: 100 } });
  engaged.activitySnapshot = {
    uniqueAssetsViewed: 4,
    mostViewedAssetID: "C",
    mostViewedCount: 12,
    mostViewedDays: 3,
    relevantAssetIDs: ["C", "D", "B", "A"],
    interestProfile: engaged.profile,
  };
  engaged.expectations = [{ name: "Discover includes diverse families", severity: "quality", rule: "discoverDiversity" }];
  const noEvents = scenario("no-week-ahead-events", { sunday: true });
  noEvents.expectations = [{ name: "No invented future events", severity: "hard", rule: "noEvents" }];
  const event = scenario("major-relevant-event", { holdings: { A: 4 }, behavior: { C: 100 }, sunday: true });
  event.events = ["B", "A"].map((asset) => ({
    id: `event-${asset}`,
    kind: "dividend",
    title: `Pagamento anunciado · ${asset}`,
    timing: { kind: "day", day: "2026-09-29" },
    issuer: { id: `issuer-${asset}`, name: `Emitente ${asset}` },
    relatedSecurityIDs: [asset],
    status: "confirmed",
    importance: "issuerSpecific",
    updatedAt: event.input.generatedAt - 60_000,
    sources: [
      {
        dataset: "evaluation.dividends",
        recordID: asset,
        name: "Emitente",
        url: `https://example.org/event/${asset}`,
        publishedAt: { kind: "day", day: "2026-09-25" },
        retrievedAt: event.input.generatedAt,
      },
    ],
    metadata: { kind: "dividend", fiscalYear: 2025, milestone: "payment" },
  }));
  event.expectations = [{ name: "Held issuer event has priority", severity: "quality", rule: "heldEventFirst" }];
  const repeated = scenario("repetitive-information", { watched: ["A", "B", "D"] });
  repeated.repeatCandidates = true;
  repeated.expectations = [{ name: "Discover avoids one-family saturation", severity: "quality", rule: "discoverDiversity" }];
  const consumed = scenario("already-consumed", { watched: ["A", "B", "D"] });
  consumed.consumedStrongest = true;
  consumed.expectations = [{ name: "Consumed duplicate is suppressed", severity: "hard", rule: "consumedSuppressed" }];
  const disabled = scenario("features-disabled", { watched: ["A"] });
  disabled.disabledFeatures = new Set(["insight_engine", "market_events"]);
  disabled.expectations = [{ name: "Disabled generation produces no facts", severity: "hard", rule: "noFinancialInsights" }];
  const significance = scenario("significance-only", { holdings: { A: 4 }, watched: ["B"], behavior: { C: 100 } });
  significance.configuration = SIGNIFICANCE_ONLY_CONFIGURATION;
  const notificationNow = newUser.input.generatedAt;
  const qualified = scenario("qualified-notification", { watched: ["A"] });
  qualified.qualifications = [[qualification("qualified-A", notificationNow - 10_000, notificationNow + 60_000), "A"]];
  qualified.expectations = [{ name: "Fresh server qualification can interrupt", severity: "hard", rule: "notificationsPresent" }];
  const expired = scenario("expired-notification", { watched: ["A"], quiet: true });
  expired.qualifications = [[qualification("expired-A", notificationNow - 180_000, notificationNow - 60_000), "A"]];
  const library = [
    newUser,
    portfolio,
    scenario("watchlist-only", { watched: ["A", "B", "D"] }),
    engaged,
    scenario("concentrated-portfolio", { holdings: { A: 99, B: 1 } }),
    scenario("diversified-portfolio", { holdings: { A: 1, B: 1, C: 1, D: 1 } }),
    scenario("quiet-market-week", { watched: ["A", "B"], quiet: true }),
    scenario("active-market-week", { watched: ["A", "B", "D"] }),
    scenario("incomplete-data", { holdings: { A: 4 }, watched: ["A", "B"], incomplete: true }),
    scenario("stale-data", { holdings: { A: 4 }, watched: ["A", "B"], stale: true }),
    scenario("market-holiday", { watched: ["A", "B"], holiday: true }),
    noEvents,
    event,
    repeated,
    consumed,
    disabled,
    significance,
    qualified,
    expired,
  ];
  for (const item of library) {
    switch (item.id) {
      case "concentrated-portfolio":
        item.expectations.push({ name: "Concentration is disclosed", severity: "quality", rule: "concentrationDisclosed" });
        break;
      case "diversified-portfolio":
        item.expectations.push({ name: "Allocation represents every holding", severity: "hard", rule: "allHoldingsRepresented" });
        break;
      case "watchlist-only":
        item.expectations.push({ name: "Watchlist content stays relevant", severity: "hard", rule: "watchlistRelevant" });
        break;
      case "active-market-week":
      case "market-holiday":
      case "significance-only":
        item.expectations.push({ name: "Verified active market remains useful", severity: "quality", rule: "usefulContent" });
        break;
    }
  }
  return library;
}
