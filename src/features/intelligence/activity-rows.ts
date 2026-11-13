"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";

import type { ActivityItem } from "@/domain/activity/activity";
import { type InsightComposer, localActivityRows, localReadIDs } from "@/domain/intelligence/activity";
import { insightComposition, localizeComposition } from "@/domain/product-voice";
import { useFormat } from "@/ui/format";

import { useIntelligence } from "./reading";
import { portfolioTiles, watchlistPresentation } from "./presentation";
import { useSymbols, useTranslate } from "./watchlist-insights";

/** The weekly reading's rows for Atividade (iOS `ActivityCenterCoordinator` local items), and how to mark them read. */
export function useLocalActivity(now: number): { rows: readonly ActivityItem[]; markRead: (rows: readonly ActivityItem[]) => void } {
  const t = useTranslate();
  const format = useFormat();
  const locale = useLocale() === "en" ? "en" : "pt";
  const symbols = useSymbols();
  const intelligence = useIntelligence();
  const state = intelligence?.state ?? null;
  const voice = intelligence?.coordinator.voice ?? null;

  const rows = useMemo(() => {
    if (!state?.userID || !voice) return [];
    const bySymbol = Object.fromEntries(symbols);
    const compose: InsightComposer = (insight) => {
      if (insight.category === "portfolio") {
        const tile = portfolioTiles([insight], insight.type === "portfolioAllocation" ? 1 : 0, false, format, t)[0];
        return tile ? { title: tile.title, body: `${tile.value} · ${tile.context}` } : null;
      }
      const composition = insightComposition(insight, voice, { symbols: bySymbol, surface: "activityCenter", format, t });
      if (composition) {
        const text = localizeComposition(composition, locale, t);
        return { title: text.title, body: text.body };
      }
      const item = watchlistPresentation(insight, symbols, format, t);
      return item.headline ? { title: item.headline, body: item.context } : null;
    };
    return localActivityRows(state.archive, { watchedIDs: state.watchedIDs, portfolioTransactions: state.transactions }, now, compose).map((row) =>
      row.destination.kind === "article" ? { ...row, destination: { ...row.destination, slug: state.slugs[row.destination.articleID] ?? null } } : row,
    );
  }, [state, voice, symbols, now, format, t, locale]);

  return { rows, markRead: (targets) => intelligence?.coordinator.markRead(localReadIDs(targets)) };
}
