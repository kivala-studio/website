"use client";

import { useContext, useEffect, useState, useSyncExternalStore } from "react";

import { ledgerFingerprint, readingObservedAt } from "@/domain/intelligence/cache";
import type { Insight } from "@/domain/intelligence/models";
import { exposureSnapshot, rankInsights, watchlistInsightCandidates } from "@/domain/personalisation";
import type { PortfolioTransaction } from "@/domain/portfolio/models";
import { personalisationSession } from "@/data/personalisation/personalisation";
import { useMarketState } from "@/features/market/market-provider";
import { usePrivacyMode } from "@/features/privacy/privacy-mode";

import type { IntelligenceCoordinator, IntelligenceState } from "./coordinator";
import { IntelligenceContext as Context } from "./intelligence-provider";

/* The weekly reading for the signed-in pages that show it (Watchlist, Portfolio, Home, Activity). */

const NO_SUBSCRIPTION = () => () => {};
const TICK_MS = 60_000;

/** The coordinator and its state; null outside the signed-in shell. */
export function useIntelligence(): { coordinator: IntelligenceCoordinator; state: IntelligenceState } | null {
  const coordinator = useContext(Context);
  const state = useSyncExternalStore(
    coordinator?.subscribe ?? NO_SUBSCRIPTION,
    () => coordinator?.getSnapshot() ?? null,
    () => coordinator?.getSnapshot() ?? null,
  );
  // Receipts and feedback change the ranking.
  useSyncExternalStore(
    (listener) => personalisationSession.subscribe(listener),
    () => personalisationSession.exposure,
    () => personalisationSession.exposure,
  );
  return coordinator && state ? { coordinator, state } : null;
}

/** Re-renders at `deadline` (a fact's expiry), so nothing expired stays on screen. */
export function useNow(deadline: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    // Every minute for the market state (Friday's close, Saturday's start); exactly at the deadline for a fact.
    const minute = window.setInterval(tick, TICK_MS);
    const timer = deadline === null ? undefined : window.setTimeout(tick, Math.max(0, deadline - Date.now()) + 20);
    return () => {
      window.clearInterval(minute);
      window.clearTimeout(timer);
    };
  }, [deadline, now]);
  return now;
}

export interface Reading {
  readonly insights: readonly Insight[];
  /** Set when the insights replay a saved reading: when its data were observed. */
  readonly savedAt: number | null;
  readonly partial: boolean;
}

const EMPTY: Reading = { insights: [], savedAt: null, partial: false };

/** The watchlist card's observations (iOS `WatchlistInsightCoordinator.candidates`): at most two, ranked. */
export function useWatchlistReading(): Reading {
  const intelligence = useIntelligence();
  const market = useMarketState();
  const hides = usePrivacyMode();
  const now = useNow(intelligence?.coordinator.nextExpiry() ?? null);
  if (!intelligence || hides) return EMPTY;
  const { coordinator, state } = intelligence;
  const securities = market.load.kind === "loaded" ? market.load.snapshot.securities : [];
  const watched = state.watchedIDs;
  const live = state.watchlist.filter((insight) => now < insight.expiresAt);
  const replayed = live.length ? [] : coordinator.replaySaved("watchlist", now, market.calendar, securities, { watchlist: watched });
  const facts = live.length ? live : replayed;
  const reading = state.saved.watchlist;
  const asOf = live.length ? now : reading ? reading.savedAt : now;
  const insights = watchlistInsightCandidates(facts, {
    watchedIDs: watched,
    consumedKeys: state.consumed,
    now: asOf,
    profile: personalisationSession.profile(new Set(), watched),
    exposure: personalisationSession.userID === state.userID ? personalisationSession.exposure : exposureSnapshot(),
  });
  return { insights, savedAt: !live.length && insights.length && reading ? readingObservedAt(reading) : null, partial: state.partial && insights.length > 0 };
}

/** The Portfolio tiles' facts (iOS `PortfolioInsightCoordinator.visible`), only for the ledger on screen. */
export function usePortfolioReading(transactionsOnScreen: readonly PortfolioTransaction[] | null): Reading {
  const intelligence = useIntelligence();
  const market = useMarketState();
  const hides = usePrivacyMode();
  const now = useNow(intelligence?.coordinator.nextExpiry() ?? null);
  if (!intelligence || hides || !transactionsOnScreen) return EMPTY;
  const { coordinator, state } = intelligence;
  const ledger = ledgerFingerprint(transactionsOnScreen);
  // A record saved since the reading was computed withdraws it until the next one.
  if (state.transactions && ledgerFingerprint(state.transactions) !== ledger) return EMPTY;
  const securities = market.load.kind === "loaded" ? market.load.snapshot.securities : [];
  const live = state.portfolio.filter((insight) => now < insight.expiresAt);
  const facts = live.length ? live : coordinator.replaySaved("portfolio", now, market.calendar, securities, { ledger });
  const insights = rankInsights(facts, {
    surface: "portfolio",
    profile: personalisationSession.profile(new Set(facts.flatMap((insight) => insight.relatedAssetIDs))),
    exposure: personalisationSession.exposure,
    now: live.length ? now : (state.saved.portfolio?.savedAt ?? now),
    limit: facts.length,
  });
  const reading = state.saved.portfolio;
  return { insights, savedAt: !live.length && insights.length && reading ? readingObservedAt(reading) : null, partial: false };
}
