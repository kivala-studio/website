import type { Format, Translate } from "../format";
import { type LocalProductVoice } from "../product-voice/local-voice";
import { insightComposition } from "../product-voice/adapter";
import type { HomeContextFeature } from "./home-context";
import type { Insight } from "./models";
import { allows, privacyClassification } from "./privacy";

/*
 * iOS `PortfolioInsightPresentation`, `WatchlistInsightPresentation` and the copy half of `HomeContextResolver`:
 * verified facts become sentences at display time. Views never calculate price movements.
 */

export interface PresentationOptions {
  readonly format: Format;
  readonly t: Translate;
}

export interface PortfolioInsightItem {
  readonly id: "largest" | "sector" | "issuer" | "strongest" | "weakest" | "weekly" | "breadth";
  readonly title: string;
  readonly value: string;
  readonly context: string;
  readonly insight: Insight;
}

/** At most two facts beside a Portfolio section (0 positions, 1 allocation, 2 summary); hidden in privacy mode. */
export function portfolioInsightItems(
  insights: readonly Insight[],
  section: number,
  { format, t, hidesPersonalValues = false }: PresentationOptions & { readonly hidesPersonalValues?: boolean },
): PortfolioInsightItem[] {
  const visible = insights.filter((insight) => allows({ surface: "inApp", privacyEnabled: hidesPersonalValues }, privacyClassification(insight)));
  const percentage = (value: Parameters<Format["boundedPercent"]>[0], signed = true) => format.boundedPercent(value, { signed });
  const performance = visible.find((insight) => insight.type === "portfolioPricePerformance");
  const allocation = visible.find((insight) => insight.type === "portfolioAllocation");
  const items: PortfolioInsightItem[] = [];
  if (section === 1 && allocation && allocation.fact.kind === "portfolioAllocation") {
    const fact = allocation.fact.value;
    const largest = fact.positions[0];
    if (largest) {
      items.push({
        id: "largest",
        title: t("portfolio.insightPresentation.largestPosition", { arg1: largest.symbol }),
        value: percentage(largest.percentage, false),
        context: t("portfolio.insightPresentation.largestPositionDetail", { arg1: format.date(fact.observedAt) }),
        insight: allocation,
      });
    }
    const sector = fact.sectors?.[0];
    const issuer = fact.issuers?.[0];
    if (sector && (fact.sectors?.length ?? 0) > 1) {
      items.push({
        id: "sector",
        title: t("portfolio.insightPresentation.issuerSector", { arg1: sector.name }),
        value: percentage(sector.percentage, false),
        context: t("portfolio.insightPresentation.sectorsIdentified"),
        insight: allocation,
      });
    } else if (issuer && (fact.issuers?.length ?? 0) > 1) {
      items.push({
        id: "issuer",
        title: t("portfolio.insightPresentation.largestIssuerWeight", { arg1: issuer.name }),
        value: percentage(issuer.percentage, false),
        context: t("portfolio.insightPresentation.allocationAtClose"),
        insight: allocation,
      });
    }
  } else if (performance && performance.fact.kind === "portfolioPerformance") {
    const fact = performance.fact.value;
    const period = format.period(fact.firstObservedAt, fact.lastObservedAt);
    if (section === 2 && fact.positions.length > 1) {
      const strongest = fact.positions[0];
      const weakest = fact.positions.at(-1);
      if (strongest && !strongest.contribution.isZero()) {
        items.push({
          id: "strongest",
          title: t("portfolio.insightPresentation.largestContribution", { arg1: strongest.symbol }),
          value: format.points(strongest.percentagePoints),
          context: t("portfolio.insightPresentation.largestContributionDetail", { arg1: period }),
          insight: performance,
        });
      }
      if (weakest && !weakest.contribution.isZero()) {
        items.push({
          id: "weakest",
          title: t("portfolio.insightPresentation.lowestContribution", { arg1: weakest.symbol }),
          value: format.points(weakest.percentagePoints),
          context: t("portfolio.insightPresentation.lowestContributionDetail"),
          insight: performance,
        });
      }
    } else {
      items.push({
        id: "weekly",
        title: t("portfolio.insightPresentation.weeklyPriceChange"),
        value: percentage(fact.percentage),
        context: t("portfolio.insightPresentation.weeklyPriceChangeDetail", { arg1: period }),
        insight: performance,
      });
      if (fact.positions.length > 1) {
        items.push({
          id: "breadth",
          title: t("portfolio.insightPresentation.positionMovements"),
          value: t("portfolio.insightPresentation.risersFallers", { arg1: String(fact.advancing), arg2: String(fact.declining) }),
          context: t("portfolio.insightPresentation.unchangedCount", { arg1: String(fact.unchanged), arg2: String(fact.positions.length) }),
          insight: performance,
        });
      }
    }
  }
  return items.slice(0, 2);
}

export interface WatchlistInsightText {
  readonly title: string;
  readonly headline: string;
  readonly context: string;
  readonly explanation: string;
  readonly formula: string;
  /** Icon role: `chart`, `list` or `newspaper`. */
  readonly icon: "chart" | "list" | "newspaper" | "info";
}

export interface WatchlistPresentationOptions extends PresentationOptions {
  /** Symbol per asset id. */
  readonly symbols: Readonly<Record<string, string>>;
  readonly surface?: string;
  /** The product voice store; null keeps the plain copy. */
  readonly voice?: LocalProductVoice | null;
  readonly now?: number;
}

const observedRange = (insight: Insight) => {
  const times = insight.provenance.observations.map((row) => row.observedAt);
  return times.length ? ([Math.min(...times), Math.max(...times)] as const) : null;
};

/** The watchlist reading's card and sheet copy; the product voice replaces headline and context when it has a phrasing. */
export function watchlistInsightText(insight: Insight, options: WatchlistPresentationOptions): WatchlistInsightText {
  const { format, t, symbols } = options;
  const asset = (id: string) => symbols[id] ?? t("common.watchedSecurity");
  let text: WatchlistInsightText;
  const { fact } = insight;
  switch (fact.kind) {
    case "priceChange":
      text = {
        title: t("watchlist.closeMovement.title"),
        headline: `${asset(fact.value.assetID)} · ${format.changePercent(fact.value.percentageChange)}`,
        context: t("common.quoteContext", { arg1: format.period(fact.value.firstObservedAt, fact.value.lastObservedAt) }),
        explanation: t("watchlist.closeMovement.description"),
        formula: t("watchlist.closeMovement.formula"),
        icon: "chart",
      };
      break;
    case "watchlistMovement": {
      const movement = fact.value.movement;
      text = {
        title: t("watchlist.largestMovement.title"),
        headline: `${asset(movement.assetID)} · ${format.changePercent(movement.percentageChange)}`,
        context: t("common.quoteContext", { arg1: format.period(movement.firstObservedAt, movement.lastObservedAt) }),
        explanation: t("watchlist.largestMovement.description", { arg1: String(fact.value.comparedAssetIDs.length) }),
        formula: t("legacy.100FechoFinalFechoDeReferencia"),
        icon: "chart",
      };
      break;
    }
    case "breadth": {
      const range = observedRange(insight);
      const period = range ? format.period(range[0], range[1]) : "";
      text = {
        title: t("watchlist.breadth.title"),
        headline: t("watchlist.breadth.headline", { arg1: String(fact.value.rising), arg2: String(fact.value.falling) }),
        context: t("watchlist.breadth.context", { arg1: String(fact.value.unchanged), arg2: String(fact.value.assetCount), arg3: period }),
        explanation: t("watchlist.breadth.description", { arg1: range ? ` Fechos: ${period}.` : "" }),
        formula: t("legacy.subidaVariacao0DescidaVariacao0"),
        icon: "list",
      };
      break;
    }
    case "watchlistSessionRun":
      text = {
        title: t("watchlist.streak.title"),
        headline: t("watchlist.streak.headline", {
          arg1: asset(fact.value.assetID),
          arg2: String(fact.value.sessions),
          arg3: t(fact.value.direction > 0 ? "legacy.subida" : "legacy.descida"),
        }),
        context: t("watchlist.streak.context", {
          arg1: format.changePercent(fact.value.percentage),
          arg2: format.period(fact.value.firstObservedAt, fact.value.lastObservedAt),
        }),
        explanation: t("watchlist.streak.description"),
        formula: t("watchlist.streak.formula"),
        icon: "chart",
      };
      break;
    case "watchlistClosingExtreme":
      text = {
        title: t("watchlist.featuredClose.title"),
        headline: t("watchlist.featuredClose.headline", { arg1: asset(fact.value.assetID), arg2: t(fact.value.isHigh ? "legacy.maximo" : "legacy.minimo") }),
        context: format.period(fact.value.firstObservedAt, fact.value.lastObservedAt),
        explanation: t("watchlist.featuredClose.description"),
        formula: t("legacy.100UltimoFechoExtremoAnteriorExtremo"),
        icon: "chart",
      };
      break;
    case "watchlistInformation":
      text = {
        title: t("watchlist.publication.title"),
        headline: fact.value.title,
        context: `${fact.value.sourceName} · ${format.date(fact.value.publishedAt)}`,
        explanation: t("watchlist.publication.description"),
        formula: t("watchlist.publication.formula"),
        icon: "newspaper",
      };
      break;
    default:
      text = { title: "", headline: "", context: "", explanation: "", formula: "", icon: "info" };
  }
  const voice = options.voice ?? null;
  if (voice) {
    const composition = insightComposition(insight, voice, { symbols, surface: options.surface ?? "watchlist", format, t }, options.now);
    if (composition) text = { ...text, headline: composition.title, context: composition.body };
  }
  return text;
}

export interface HomeContextText {
  readonly eyebrow: string;
  readonly headline: string;
  readonly detail: string;
  readonly actionTitle: string;
}

/** The Home context card's words. No personal amount or holding quantity is ever part of them. */
export function homeContextText(feature: HomeContextFeature, options: WatchlistPresentationOptions): HomeContextText {
  const { format, t } = options;
  const content = feature.content;
  const label = (period: { start: number; endExclusive: number }) => format.period(period.start, period.endExclusive - 86_400_000);
  switch (content.kind) {
    case "portfolioWrap":
      return {
        eyebrow: t("intelligence.weekSummary.eyebrow", { arg1: label(content.period) }),
        headline: t("intelligence.weekSummary.headline", { arg1: format.changePercent(content.percentage) }),
        detail: t("intelligence.weekSummary.detail"),
        actionTitle: t("common.viewMyWrap"),
      };
    case "watchlistMoverWrap":
      return {
        eyebrow: t("intelligence.watchlistMover.eyebrow", { arg1: label(content.period) }),
        headline: t("intelligence.watchlistMover.headline", { arg1: content.symbol, arg2: format.changePercent(content.percentage) }),
        detail: t("intelligence.watchlistMover.detail"),
        actionTitle: t("common.viewMyWrap"),
      };
    case "weeklyClose":
      return {
        eyebrow: t("intelligence.weeklyClose.eyebrow", { arg1: label(content.period) }),
        headline: t("intelligence.weeklyClose.headline", { arg1: String(content.rises), arg2: String(content.count) }),
        detail: t("intelligence.weeklyClose.detail"),
        actionTitle: t("intelligence.weeklyClose.action"),
      };
    case "watchlist": {
      const text = watchlistInsightText(content.insight, { ...options, surface: "home" });
      return { eyebrow: text.title, headline: text.headline, detail: text.context, actionTitle: t("intelligence.home.viewWatchlist") };
    }
    case "discovery":
      return {
        eyebrow: t("intelligence.discover.eyebrow"),
        headline: content.headline,
        detail: content.detail,
        actionTitle: t("intelligence.discover.action"),
      };
    case "weekAhead":
      return {
        eyebrow: t("intelligence.nextWeek.eyebrow"),
        headline: content.headline,
        detail: content.detail,
        actionTitle: t("intelligence.nextWeek.action"),
      };
  }
}
