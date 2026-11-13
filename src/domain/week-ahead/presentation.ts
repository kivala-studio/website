import type { Format, Translate } from "@/domain/format";

import { type EventSource, type EventStatus, type MarketEvent, type Relationship, type WeekPeriod, type WeekSelection, lastDay } from "./week-ahead";

/** iOS `WeekAheadPresentation`: the words of the week ahead, from the message catalogue. */
export function weekAheadText(t: Translate, format: Format) {
  const count = (key: string, n: number, one: string, many: string) => t(key, { arg1: String(n), arg2: t(n === 1 ? one : many) });

  return {
    summary(selection: WeekSelection): string {
      if (selection.portfolioCount > 0) return count("formatting.weekAhead.portfolioCount", selection.portfolioCount, "legacy.eventoRelacionado", "legacy.eventosRelacionados");
      if (selection.watchlistCount > 0) return count("formatting.weekAhead.watchlistCount", selection.watchlistCount, "legacy.eventoRelacionado", "legacy.eventosRelacionados");
      return count("formatting.weekAhead.nextWeekCount", selection.ranked.length, "legacy.eventoAnunciado", "legacy.eventosAnunciados");
    },
    /** The second line when both relationships exist. */
    watchlistLine: (n: number) => count("weekAhead.summary.watchlistCount", n, "legacy.eventoRelacionado", "legacy.eventosRelacionados"),
    period: (period: WeekPeriod) => format.civilPeriod(period.id, lastDay(period)),
    timing(event: MarketEvent): string {
      const timing = event.timing;
      switch (timing.kind) {
        case "day":
          return t("formatting.weekAhead.timeNotAnnounced", { arg1: format.civilDate(timing.day) });
        case "instant":
          return format.timestamp(timing.at);
        case "days":
          return t("formatting.weekAhead.timesNotAnnounced", { arg1: format.civilDate(timing.start), arg2: format.civilDate(timing.endInclusive) });
        case "interval":
          return t("formatting.weekAhead.exclusiveEnd", { arg1: format.timestamp(timing.start), arg2: format.timestamp(timing.endExclusive) });
      }
    },
    status: (status: EventStatus) =>
      t(status === "confirmed" ? "formatting.weekAhead.dateAnnounced" : status === "tentative" ? "formatting.weekAhead.dateProvisional" : "formatting.weekAhead.cancelled"),
    relationship: (value: Relationship) =>
      t(value === "portfolio" ? "formatting.weekAhead.relatedPortfolio" : value === "watchlist" ? "formatting.weekAhead.relatedWatchlist" : "common.market"),
    publication(source: EventSource): string {
      const published = source.publishedAt;
      if (!published) return t("formatting.weekAhead.sourceDateMissing");
      return t("common.sourcePublishedOn", { arg1: published.kind === "day" ? format.civilDate(published.day) : format.timestamp(published.at) });
    },
  };
}
