import { createTranslator } from "next-intl";

import pt from "../../../../messages/pt.json";
import { type Translate, createFormat } from "../../format";
import type { DataQualityReport } from "../../market/quality";
import type { EpochMs } from "../../market/zone";
import { personalizationContext } from "../../personalisation/candidate";
import type { PersonalizationSurface } from "../../personalisation/configuration";
import { evaluatePersonalization } from "../../personalisation/engine";
import { type PersonalizationAvailability, setPersonalizationAvailability } from "../../personalisation/availability";
import {
  type InsightPersonalizationContext,
  insightCandidates,
  isPublication,
  rankInsights,
  receiptKeys,
  watchlistInsightCandidates,
} from "../../personalisation/insight-personalization";
import { evaluateNotification } from "../../personalisation/notification";
import { interestProfile } from "../../personalisation/profile";
import { selectDiscover } from "../../personalisation/saturday-discover";
import { LocalProductVoice } from "../../product-voice/local-voice";
import { weekAheadText } from "../../week-ahead/presentation";
import { type MarketEvent, nextWeek, selectWeek, semanticKey, verifiedClosures, weekAheadOffer } from "../../week-ahead/week-ahead";
import { insightItems } from "../activity";
import { IntelligenceDebugCapture } from "../debug";
import { InsightEngine } from "../engine";
import {
  INTELLIGENCE_FEATURES,
  type IntelligenceAvailability,
  type IntelligenceFeatureConfiguration,
  allows,
  permitsInsightType,
  personalizationVersion,
  resolveAvailability,
} from "../feature-controls";
import { type HomeContextDestination, type HomeContextOffer, resolveHomeContext } from "../home-context";
import type { Insight } from "../models";
import { homeContextText, portfolioInsightItems, watchlistInsightText } from "../presentation";
import type { WeeklyWrap } from "../weekly-wrap";
import type { EvaluationScenario, Severity } from "./scenarios";
import { type Json, compact, date, encodeEvent, encodeInsight, encodeObservation, encodePortfolioEvidence, encodeValue, stringify } from "./swift-json";

/*
 * iOS `IntelligenceEvaluationHarness` (test target): an adapter over the production pipelines, never an alternate
 * ranking implementation. Its report is compared with the iOS export by `scripts/compare-intelligence-evaluations.py`.
 */

export interface Decision {
  readonly id: string;
  readonly result: string;
  readonly score?: number;
  readonly relationship?: number;
  readonly significance?: number;
  readonly significanceLevel: string;
  readonly interest?: number;
  readonly novelty?: number;
  readonly recency?: number;
  readonly marketImportance?: number;
  readonly feedback?: number;
}

export interface Finding {
  readonly name: string;
  readonly severity: Severity;
  readonly passed: boolean;
}

export interface Trace {
  readonly context: string;
  readonly layer: string;
  readonly subject: string;
  readonly stage: string;
  readonly reason: string;
  readonly insightID?: string;
  readonly selectedPosition?: number;
  readonly rank?: number;
  readonly validation?: string;
  readonly diversity?: string;
}

export interface Report {
  readonly schemaVersion: 1;
  readonly scenario: string;
  readonly asOf: EpochMs;
  readonly marketState: string;
  readonly disabledFeatures: readonly string[];
  readonly inputs: Json;
  readonly facts: readonly Insight[];
  readonly surfaces: Record<string, string[]>;
  readonly presentations: Record<string, string[]>;
  readonly decisions: Record<string, Decision[]>;
  readonly traces: Trace[];
  readonly findings: Finding[];
  readonly wrap: WeeklyWrap | null;
  readonly wrapJSON: Json | null;
  readonly events: readonly MarketEvent[];
  readonly traceOmissions: number;
}

const t = createTranslator({ locale: "pt", messages: pt }) as unknown as Translate;
const format = createFormat("pt", t);
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const QUALITY_TYPE = "InvestAOMarketLogic.DataQualityReport";
/** Swift's `String(describing:)` of a `DataQualityReport`. */
function describeQuality(report: DataQualityReport): string {
  const optional = (value: number | undefined) => (value === undefined ? "nil" : `Optional(${value})`);
  const reasons = report.reasons.map((reason) => `${QUALITY_TYPE}.Reason.${reason}`).join(", ");
  return `DataQualityReport(status: ${QUALITY_TYPE}.Status.${report.status}, reasons: [${reasons}], observedAt: ${optional(report.observedAt)}, validUntilEpoch: ${optional(report.validUntilEpoch)}, sourceObservedAtEpoch: ${optional(report.sourceObservedAtEpoch)})`;
}

function describeDestination(destination: HomeContextDestination): string {
  switch (destination.kind) {
    case "discovery":
    case "weekAhead":
      return `${destination.kind}(${JSON.stringify(destination.id)})`;
    case "watchlist":
      return "watchlist";
    case "weeklyWrap":
      return `weeklyWrap(${destination.period.kind}-${date(destination.period.start)})`;
  }
}

const SURFACES: readonly PersonalizationSurface[] = ["portfolio", "watchlist", "weeklyWrap", "saturdayDiscover", "home", "activityCenter", "notification"];

/** Builds the weekly wrap for the scenario; W15 owns the assembly, so the harness accepts it as a dependency. */
export type WrapMaker = (scenario: EvaluationScenario, availability: IntelligenceAvailability) => { wrap: WeeklyWrap; json: Json } | null;

export function runScenario(scenario: EvaluationScenario, makeWrap: WrapMaker | null = null): Report {
  const now = scenario.input.generatedAt;
  const configuration: IntelligenceFeatureConfiguration = {
    schemaVersion: 1,
    version: 1,
    minimumAppBuild: 0,
    effectiveAt: now - 3_600_000,
    expiresAt: now + 3_600_000,
    features: Object.fromEntries(
      INTELLIGENCE_FEATURES.map((feature) => [
        feature,
        {
          enabled: feature !== "personalization_v2" && !scenario.disabledFeatures.has(feature),
          killSwitch: false,
          rolloutPercentage: 100,
          rolloutSalt: "evaluation-v1",
          audiences: ["production", "beta", "internal"],
        },
      ]),
    ),
  };
  const availability = resolveAvailability({
    configuration,
    identity: "evaluation-install",
    audience: "internal",
    appBuild: 1,
    now,
    notificationsTrusted: true,
  });
  const engineAvailability = {
    allows: (feature: Parameters<typeof allows>[1]) => allows(availability, feature),
    permits: (type: Insight["type"]) => permitsInsightType(availability, type),
  };
  const personalization: PersonalizationAvailability = {
    personalizationVersion: personalizationVersion(availability),
    personalizedHome: allows(availability, "personalized_home"),
    permits: (type) => permitsInsightType(availability, type),
  };
  setPersonalizationAvailability(() => personalization);
  const capture = IntelligenceDebugCapture.shared;
  capture.clear();
  capture.setEnabled(true);
  try {
    const generated = [...new InsightEngine({ includesMarketPublications: true, availability: engineAvailability }).evaluate(scenario.input)].sort((a, b) =>
      byText(a.id, b.id),
    );
    const traces: Trace[] = [];
    let omissions = 0;
    const collectTraces = () => {
      const tokenizer = capture.begin("generation", "evaluation-identity", now)!;
      const tokens = new Map(generated.map((insight) => [tokenizer.token(insight.id), insight.id]));
      for (const snapshot of [...capture.snapshots()].reverse()) {
        omissions += snapshot.omittedDecisions;
        for (const decision of snapshot.decisions) {
          const insightID = decision.token === undefined ? undefined : tokens.get(decision.token);
          traces.push({
            context: snapshot.context,
            layer: snapshot.layer,
            subject: decision.subject,
            stage: decision.stage,
            reason: decision.reason,
            ...(insightID === undefined ? {} : { insightID }),
            ...(decision.selectedPosition === undefined ? {} : { selectedPosition: decision.selectedPosition }),
            ...(decision.rank === undefined ? {} : { rank: decision.rank }),
            ...(decision.validation === undefined ? {} : { validation: describeQuality(decision.validation) }),
            ...(decision.score === undefined ? {} : { diversity: decision.score.diversity }),
          });
        }
      }
      // Drain before the bounded ring can evict an earlier stage.
      capture.clear();
    };
    collectTraces();
    const insights = scenario.repeatCandidates ? [...generated, ...generated] : generated;
    const assets = new Set(scenario.input.observations.map((row) => row.assetID));
    const adapter: InsightPersonalizationContext = {
      now,
      heldIDs: scenario.profile.holdingIDs,
      watchedIDs: scenario.profile.watchedIDs,
      availableAssetIDs: assets,
    };
    const issuerByAsset = new Map([...assets].map((id) => [id, `issuer-${id}`]));
    let exposure = scenario.exposure;
    let consumedID: string | null = null;
    if (scenario.consumedStrongest) {
      const before = rankInsights(insights, {
        surface: "saturdayDiscover",
        profile: scenario.profile,
        availableAssetIDs: assets,
        marketState: scenario.marketState,
        now,
        limit: 5,
      });
      const strongest = before[0];
      if (strongest) {
        consumedID = strongest.id;
        exposure = { ...exposure, opened: new Set([...exposure.opened, ...receiptKeys(strongest)]) };
      }
      collectTraces();
    }
    const surfaces: Record<string, string[]> = {};
    const decisions: Record<string, Decision[]> = {};
    for (const surface of SURFACES) {
      const domain = insights.filter((insight) => {
        switch (surface) {
          case "portfolio":
            return insight.category === "portfolio";
          case "watchlist":
            return insight.category === "watchlist";
          case "activityCenter":
            return insight.category === "watchlist" || insight.type === "portfolioPricePerformance";
          default:
            return true;
        }
      });
      const evaluation = evaluatePersonalization(
        insightCandidates(domain, adapter, surface, issuerByAsset),
        personalizationContext({ surface, now, profile: scenario.profile, exposure, marketState: scenario.marketState }),
        surface === "home" ? 1 : 5,
        scenario.configuration,
        personalization,
      );
      surfaces[`ranking:${surface}`] = evaluation.selected.map((d) => d.candidate.id);
      decisions[surface] = [...evaluation.decisions]
        .sort((a, b) => byText(a.candidate.id, b.candidate.id))
        .map((d) => ({
          id: d.candidate.id,
          result: d.rejection ?? d.selectionReason ?? "eligible",
          ...(d.score
            ? {
                score:
                  d.score.relationship +
                  d.score.significance +
                  d.score.recency +
                  d.score.novelty +
                  d.score.interest +
                  d.score.marketImportance +
                  d.score.feedback,
                relationship: d.score.relationship,
                significance: d.score.significance,
                interest: d.score.interest,
                novelty: d.score.novelty,
                recency: d.score.recency,
                marketImportance: d.score.marketImportance,
                feedback: d.score.feedback,
              }
            : {}),
          significanceLevel: d.candidate.significance,
        }));
      collectTraces();
    }
    const portfolio = rankInsights(
      insights.filter((insight) => insight.category === "portfolio"),
      { surface: "portfolio", profile: scenario.profile, exposure, availableAssetIDs: assets, now, limit: insights.length },
    );
    surfaces.portfolio = portfolio.map((insight) => insight.id);
    surfaces.watchlist = watchlistInsightCandidates(insights, { watchedIDs: scenario.profile.watchedIDs, consumedKeys: exposure.opened, now, limit: 5 }).map(
      (insight) => insight.id,
    );
    collectTraces();
    const calendarValidUntil = scenario.input.calendar?.validUntil ?? now;
    const discover = allows(availability, "saturday_discover")
      ? selectDiscover(insights, {
          now,
          marketState: scenario.marketState,
          calendarValidUntil,
          heldIDs: scenario.profile.holdingIDs,
          watchedIDs: scenario.profile.watchedIDs,
          availableAssetIDs: assets,
          consumedKeys: exposure.opened,
          profile: scenario.profile,
          exposure,
        })
      : [];
    surfaces.saturdayDiscover = discover.map((selection) => selection.id);
    collectTraces();
    surfaces.activityCenter = allows(availability, "activity_center")
      ? insightItems(insights, scenario.profile.watchedIDs, now, {
          rank: (eligible, profile, at, limit) => rankInsights(eligible, { surface: "activityCenter", profile: interestProfile(profile), now: at, limit }),
          receiptKeys,
        }).map((item) => item.id)
      : [];
    collectTraces();
    const period = nextWeek(now)!;
    const calendar = scenario.input.calendar ?? undefined;
    const eventSelection = selectWeek(
      { events: allows(availability, "week_ahead") ? scenario.events : [], fetchedAt: now },
      {
        now,
        period,
        heldIDs: scenario.profile.holdingIDs,
        watchedIDs: scenario.profile.watchedIDs,
        securities: [...assets].sort(byText).map((id) => ({ id, issuerID: `issuer-${id}`, isEquity: true })),
        hidesPersonalValues: false,
        closedDays: new Set(verifiedClosures(calendar, period, now) ?? []),
        profile: scenario.profile,
        exposure,
      },
    );
    const events = eventSelection.ranked;
    surfaces.weekAhead = events.map((item) => item.id);
    collectTraces();
    // Client interruption selection is separate from fact-derived ranking diagnostics.
    surfaces.notifications = allows(availability, "intelligence_notifications")
      ? scenario.qualifications.flatMap(([qualification, asset]) => {
          const selected = evaluateNotification(qualification, asset, exposure, now).selected.map((d) => d.candidate.id);
          collectTraces();
          return selected;
        })
      : [];
    const built = allows(availability, "weekly_wrap") && makeWrap ? makeWrap(scenario, availability) : null;
    const wrap = built?.wrap ?? null;
    collectTraces();
    surfaces.weeklyWrap = wrap?.stories.map((story) => story.kind) ?? [];
    const offer = (kind: HomeContextOffer["kind"], ids: readonly string[]): HomeContextOffer | null =>
      ids.length === 0
        ? null
        : {
            kind,
            headline: kind === "discovery" ? "Descobrir esta semana" : "A próxima semana",
            detail: `${ids.length} informações verificadas`,
            destinationID: kind === "discovery" ? "evaluation-discover" : period.id,
            evidenceIDs: ids,
            availableAt: now - 60_000,
            expiresAt: now + 600_000,
            isConsumed: false,
          };
    const words = weekAheadText(t, format);
    const weekOffer = allows(availability, "week_ahead") ? weekAheadOffer(eventSelection, period, now - 60_000, calendar, now) : null;
    const home = resolveHomeContext(
      {
        now,
        marketState: scenario.marketState,
        calendarValidUntil,
        wrapPeriods: wrap ? [wrap.period] : [],
        wrap,
        completedWrapKeys: new Set(),
        hidesPersonalValues: false,
        isOffline: false,
        discovery: offer(
          "discovery",
          discover.map((selection) => selection.id),
        ),
        weekAhead: weekOffer
          ? {
              kind: "weekAhead",
              headline: words.summary(eventSelection),
              detail: t("intelligence.weekAhead.datesAnnounced", { arg1: words.period(period) }),
              destinationID: weekOffer.destinationID,
              evidenceIDs: eventSelection.ranked.map((item) => item.id),
              availableAt: now - 60_000,
              expiresAt: weekOffer.expiresAt,
              exposureKeys: eventSelection.ranked.map((item) => `event:${semanticKey(item.event)}`),
              isConsumed: false,
            }
          : null,
        calendar: scenario.input.calendar,
        watchlistInsights: insights,
      },
      {
        availability,
        watchlistCandidate: (candidates) =>
          watchlistInsightCandidates(candidates, {
            watchedIDs: scenario.profile.watchedIDs,
            consumedKeys: exposure.opened,
            now,
            limit: 1,
            surface: "home",
          })[0] ?? null,
        receiptKeys: (insight) => [...receiptKeys(insight)],
      },
    );
    surfaces.home = home ? [describeDestination(home.destination)] : [];
    const symbols = Object.fromEntries([...assets].map((id) => [id, id]));
    const voice = new LocalProductVoice(null);
    const options = { format, t, symbols, voice };
    const homeText = home ? homeContextText(home, options) : null;
    const presentations: Record<string, string[]> = {
      home: homeText ? [homeText.eyebrow, homeText.headline, homeText.detail, homeText.actionTitle] : [],
    };
    for (const section of [0, 1, 2]) {
      presentations[`portfolio:${section}`] = portfolioInsightItems(portfolio, section, { format, t }).map(
        (item) => `${item.insight.id}: ${item.title} · ${item.value} · ${item.context}`,
      );
    }
    presentations.weekAhead = events.map((item) => `${item.id}: ${item.event.title} · ${words.timing(item.event)} · ${words.status(item.event.status)}`);
    presentations.watchlist = insights
      .filter((insight) => surfaces.watchlist.includes(insight.id))
      .map((insight) => {
        const text = watchlistInsightText(insight, options);
        return `${insight.id}: ${text.title} · ${text.headline} · ${text.context}`;
      });
    collectTraces();
    const portfolioWrap = wrap?.portfolio ?? null;
    const findings: Finding[] = scenario.expectations.map((expectation) => {
      let passed: boolean;
      switch (expectation.rule) {
        case "noFinancialInsights":
          passed = generated.every(isPublication) && portfolioWrap === null;
          break;
        case "noWeeklyPerformance":
          passed = !generated.some((insight) => insight.type === "portfolioPricePerformance") && portfolioWrap === null;
          break;
        case "noNotifications":
          passed = surfaces.notifications.length === 0 && surfaces["ranking:notification"].length === 0;
          break;
        case "noEvents":
          passed = events.length === 0 && !surfaces.home.some((value) => value.includes("weekAhead"));
          break;
        case "heldEventFirst":
          passed = events[0]?.event.relatedSecurityIDs.includes("A") === true;
          break;
        case "discoverDiversity":
          passed = new Set(discover.map((selection) => selection.insight.type)).size >= 2;
          break;
        case "consumedSuppressed":
          passed = consumedID !== null && !discover.some((selection) => selection.id === consumedID);
          break;
        case "usefulContent":
          passed = discover.length > 0 && home !== null;
          break;
        case "portfolioNearTop":
          passed = discover.slice(0, 2).some((selection) => selection.insight.category === "portfolio");
          break;
        case "notificationsPresent":
          passed = JSON.stringify(surfaces.notifications) === JSON.stringify(["qualified-A"]);
          break;
        case "concentrationDisclosed":
          passed =
            generated.some(
              (insight) => insight.fact.kind === "portfolioAllocation" && (insight.fact.value.positions[0]?.percentage.greaterThan(90) ?? false),
            ) && surfaces.portfolio.length > 0;
          break;
        case "allHoldingsRepresented":
          passed = generated.some((insight) => {
            if (insight.fact.kind !== "portfolioAllocation") return false;
            const ids = new Set(insight.fact.value.positions.map((position) => position.assetID));
            return ids.size === scenario.profile.holdingIDs.size && [...ids].every((id) => scenario.profile.holdingIDs.has(id));
          });
          break;
        case "watchlistRelevant":
          passed =
            surfaces.watchlist.length > 0 &&
            generated
              .filter((insight) => surfaces.watchlist.includes(insight.id))
              .every((insight) => insight.relatedAssetIDs.every((id) => scenario.profile.watchedIDs.has(id)));
          break;
      }
      return { name: expectation.name, severity: expectation.severity, passed };
    });
    const input = scenario.input;
    const config = scenario.configuration;
    const inputs: Json = {
      period: encodeValue(input.period)!,
      fetchedAt: date(input.fetchedAt),
      ...(input.calendar ? { calendarVersion: input.calendar.version, calendarValidUntil: date(input.calendar.validUntil) } : {}),
      observations: [...input.observations].sort((a, b) => byText(a.recordID, b.recordID)).map(encodeObservation),
      ...(input.portfolio ? { portfolio: encodePortfolioEvidence(input.portfolio) } : {}),
      publications: (input.publications?.articles ?? []).map((article) => encodeValue(article)!),
      events: scenario.events.map(encodeEvent),
      relationshipsAndExposure: {
        holdings: [...scenario.profile.holdingIDs].sort(byText),
        watchlist: [...scenario.profile.watchedIDs].sort(byText),
        alerts: [...scenario.profile.alertIDs].sort(byText),
        activityAssets: [...input.activityAssetIDs],
        shown: [...exposure.shown].sort(byText),
        opened: [...exposure.opened].sort(byText),
        topics: [...exposure.topics].sort(byText),
        homeShown: [...exposure.homeShown].sort(byText),
      },
      behavior: Object.fromEntries(scenario.profile.behavior),
      diagnosticWeights: {
        holdings: config.holdingWeight,
        watchlist: config.watchlistWeight,
        alerts: config.alertWeight,
        maximumBehavior: config.maximumBehaviorWeight,
        unseen: config.unseenWeight,
        seenPenalty: config.seenPenalty,
      },
    };
    return {
      schemaVersion: 1,
      scenario: scenario.id,
      asOf: now,
      marketState: scenario.marketState,
      disabledFeatures: [...scenario.disabledFeatures].sort(byText),
      inputs,
      facts: generated,
      surfaces,
      presentations,
      decisions,
      traces,
      findings,
      wrap,
      wrapJSON: built?.json ?? null,
      events: events.map((item) => item.event),
      traceOmissions: omissions,
    };
  } finally {
    capture.clear(true);
    setPersonalizationAvailability(null);
  }
}

function reportJSON(report: Report): Json {
  return {
    schemaVersion: report.schemaVersion,
    scenario: report.scenario,
    asOf: date(report.asOf),
    marketState: report.marketState,
    disabledFeatures: [...report.disabledFeatures],
    inputs: report.inputs,
    facts: report.facts.map(encodeInsight),
    surfaces: report.surfaces,
    presentations: report.presentations,
    decisions: Object.fromEntries(Object.entries(report.decisions).map(([key, rows]) => [key, rows.map((row) => encodeValue(row)!)])),
    traces: report.traces
      .map((trace) => encodeValue(trace)!)
      .map((trace) => [compact(trace), trace] as const)
      .sort((a, b) => byText(a[0], b[0]))
      .map(([, trace]) => trace),
    findings: report.findings.map((finding) => encodeValue(finding)!),
    ...(report.wrapJSON ? { wrap: report.wrapJSON } : {}),
    events: report.events.map(encodeEvent),
    traceOmissions: report.traceOmissions,
  };
}

/** The suite export, identical across runs and input orders. */
export function encodeReports(reports: readonly Report[]): string {
  return stringify(reports.map(reportJSON));
}
