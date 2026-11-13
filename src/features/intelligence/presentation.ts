import type { Format, Translate } from "@/domain/format";
import type { Insight, PortfolioPricePerformanceFact } from "@/domain/intelligence/models";
import { allows, privacyClassification } from "@/domain/intelligence/privacy";
import type { IconName } from "@/ui/icons/icon";

/*
 * Copy for verified facts (iOS `WatchlistInsightPresentation`, `PortfolioInsightPresentation`). Formatting never
 * recalculates a fact: every number below is read from it as it was verified.
 */

export interface WatchlistPresentation {
  /** The detail's long caption. */
  readonly title: string;
  /** The card's short caption. */
  readonly summaryTitle: string;
  readonly headline: string;
  readonly context: string;
  readonly explanation: string;
  readonly icon: IconName;
}

const period = (format: Format, first: number, last: number) => format.period(first, last);

export function watchlistPresentation(insight: Insight, symbols: ReadonlyMap<string, string>, format: Format, t: Translate): WatchlistPresentation {
  const asset = (id: string) => symbols.get(id) ?? t("common.watchedSecurity");
  const fact = insight.fact;
  const base = (title: string, headline: string, context: string, explanation: string, icon: IconName = "chart"): WatchlistPresentation => ({
    title,
    summaryTitle: title,
    headline,
    context,
    explanation,
    icon,
  });
  switch (fact.kind) {
    case "priceChange":
      return base(
        t("watchlist.closeMovement.title"),
        `${asset(fact.value.assetID)} · ${format.changePercent(fact.value.percentageChange)}`,
        t("common.quoteContext", { arg1: period(format, fact.value.firstObservedAt, fact.value.lastObservedAt) }),
        t("watchlist.closeMovement.description"),
      );
    case "watchlistMovement": {
      const movement = fact.value.movement;
      return {
        ...base(
          t("watchlist.largestMovement.title"),
          `${asset(movement.assetID)} · ${format.changePercent(movement.percentageChange)}`,
          t("common.quoteContext", { arg1: period(format, movement.firstObservedAt, movement.lastObservedAt) }),
          t("watchlist.largestMovement.description", { arg1: String(fact.value.comparedAssetIDs.length) }),
        ),
        summaryTitle: t("watchlist.insight.largestMovement"),
      };
    }
    case "breadth": {
      const times = insight.provenance.observations.map((row) => row.observedAt);
      const span = times.length ? period(format, Math.min(...times), Math.max(...times)) : "";
      return {
        ...base(
          t("watchlist.breadth.title"),
          t("watchlist.breadth.headline", { arg1: String(fact.value.rising), arg2: String(fact.value.falling) }),
          t("watchlist.breadth.context", { arg1: String(fact.value.unchanged), arg2: String(fact.value.assetCount), arg3: span }),
          // The period already reads on the context line.
          t("watchlist.breadth.description", { arg1: "" }),
          "watchlist",
        ),
        summaryTitle: t("watchlist.insight.watchedSecurities"),
      };
    }
    case "watchlistSessionRun":
      return base(
        t("watchlist.streak.title"),
        t("watchlist.streak.headline", {
          arg1: asset(fact.value.assetID),
          arg2: String(fact.value.sessions),
          arg3: fact.value.direction > 0 ? t("legacy.subida") : t("legacy.descida"),
        }),
        t("watchlist.streak.context", {
          arg1: format.changePercent(fact.value.percentage),
          arg2: period(format, fact.value.firstObservedAt, fact.value.lastObservedAt),
        }),
        t("watchlist.streak.description"),
      );
    case "watchlistClosingExtreme":
      return base(
        t("watchlist.featuredClose.title"),
        t("watchlist.featuredClose.headline", { arg1: asset(fact.value.assetID), arg2: fact.value.isHigh ? t("legacy.maximo") : t("legacy.minimo") }),
        period(format, fact.value.firstObservedAt, fact.value.lastObservedAt),
        t("watchlist.featuredClose.description"),
      );
    case "watchlistInformation":
      return base(
        t("watchlist.publication.title"),
        fact.value.title,
        `${fact.value.sourceName} · ${format.date(fact.value.publishedAt)}`,
        t("watchlist.publication.description"),
        "news",
      );
    default:
      return base("", "", "", "", "info");
  }
}

export interface PortfolioTile {
  readonly id: "largest" | "sector" | "issuer" | "strongest" | "weakest" | "weekly" | "breadth";
  readonly title: string;
  readonly value: string;
  readonly context: string;
  readonly insight: Insight;
}

/** The Portfolio tab's section: 0 positions, 1 allocation, 2 summary. */
export type PortfolioSection = 0 | 1 | 2;

const performancePeriod = (format: Format, fact: PortfolioPricePerformanceFact) => period(format, fact.firstObservedAt, fact.lastObservedAt);

/** At most two tiles for the selected tab; nothing in privacy mode (portfolio facts are private financial). */
export function portfolioTiles(
  insights: readonly Insight[],
  section: PortfolioSection,
  hidesPersonalValues: boolean,
  format: Format,
  t: Translate,
): PortfolioTile[] {
  const visible = insights.filter((insight) => allows({ surface: "inApp", privacyEnabled: hidesPersonalValues }, privacyClassification(insight)));
  const performance = visible.find((insight) => insight.type === "portfolioPricePerformance");
  const allocation = visible.find((insight) => insight.type === "portfolioAllocation");
  const items: PortfolioTile[] = [];
  if (section === 1 && allocation?.fact.kind === "portfolioAllocation") {
    const fact = allocation.fact.value;
    const largest = fact.positions[0];
    if (largest) {
      items.push({
        id: "largest",
        title: t("portfolio.insightPresentation.largestPosition", { arg1: largest.symbol }),
        value: format.boundedPercent(largest.percentage, { signed: false }),
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
        value: format.boundedPercent(sector.percentage, { signed: false }),
        context: t("portfolio.insightPresentation.sectorsIdentified"),
        insight: allocation,
      });
    } else if (issuer && (fact.issuers?.length ?? 0) > 1) {
      items.push({
        id: "issuer",
        title: t("portfolio.insightPresentation.largestIssuerWeight", { arg1: issuer.name }),
        value: format.boundedPercent(issuer.percentage, { signed: false }),
        context: t("portfolio.insightPresentation.allocationAtClose"),
        insight: allocation,
      });
    }
  } else if (performance?.fact.kind === "portfolioPerformance") {
    const fact = performance.fact.value;
    if (section === 2 && fact.positions.length > 1) {
      const strongest = fact.positions[0];
      const weakest = fact.positions.at(-1);
      if (strongest && !strongest.contribution.isZero()) {
        items.push({
          id: "strongest",
          title: t("portfolio.insightPresentation.largestContribution", { arg1: strongest.symbol }),
          value: format.points(strongest.percentagePoints),
          context: t("portfolio.insightPresentation.largestContributionDetail", { arg1: performancePeriod(format, fact) }),
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
        value: format.boundedPercent(fact.percentage),
        context: t("portfolio.insightPresentation.weeklyPriceChangeDetail", { arg1: performancePeriod(format, fact) }),
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
