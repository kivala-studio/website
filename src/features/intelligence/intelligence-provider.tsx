"use client";

import { type ReactNode, createContext, useEffect, useState, useSyncExternalStore } from "react";

import { useAccount } from "@/features/account/account-provider";
import { useMarketState } from "@/features/market/market-provider";
import { usePrivacyMode } from "@/features/privacy/privacy-mode";

import type { IntelligenceCoordinator } from "./coordinator";

/*
 * The signed-in shell's weekly reading. The shell also frames the public market for signed-in visitors, so this
 * module stays light: the engine, its catalogue and the product voice load on demand once an account is signed in.
 */

export const IntelligenceContext = createContext<IntelligenceCoordinator | null>(null);
/** A failed or empty refresh is tried again at most this often while the tab is visible. */
const RETRY_MS = 5 * 60_000;

export function IntelligenceProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const userID = account?.userID ?? null;
  const [coordinator, setCoordinator] = useState<IntelligenceCoordinator | null>(null);
  useEffect(() => {
    if (!userID || coordinator) return;
    let live = true;
    void import("./coordinator").then((module) => {
      if (live) setCoordinator(module.intelligenceCoordinator());
    });
    return () => {
      live = false;
    };
  }, [userID, coordinator]);

  return (
    <IntelligenceContext.Provider value={coordinator}>
      {coordinator && userID ? <Refresh coordinator={coordinator} userID={userID} /> : null}
      {children}
    </IntelligenceContext.Provider>
  );
}

/** Keeps the reading current: on input changes, when the tab returns, every few minutes and at each fact's expiry. */
function Refresh({ coordinator, userID }: { coordinator: IntelligenceCoordinator; userID: string }) {
  const account = useAccount();
  const market = useMarketState();
  const hidesPersonalValues = usePrivacyMode();
  const securities = market.load.kind === "loaded" && market.hasLoadedLiveSnapshot ? market.load.snapshot.securities : undefined;
  const calendar = market.calendar;
  const watched = account?.watchlist.join(",") ?? "";
  // Subscribed so the expiry timer below follows every new reading.
  useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot, coordinator.getSnapshot);

  useEffect(() => {
    coordinator.setPrivacyMode(hidesPersonalValues);
  }, [coordinator, hidesPersonalValues]);

  useEffect(() => {
    const refresh = (force = false) => {
      if (document.hidden) return;
      void coordinator.refresh({ userID, calendar, securities, watchedIDs: watched ? watched.split(",") : [], hidesPersonalValues }, force);
    };
    refresh();
    const onVisible = () => refresh();
    document.addEventListener("visibilitychange", onVisible);
    const retry = window.setInterval(() => refresh(), RETRY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(retry);
    };
    // The calendar and quotes change often; the coordinator itself skips a refresh that is not due.
  }, [coordinator, userID, calendar, securities, watched, hidesPersonalValues]);

  // Facts leave the screen exactly at their expiry; a new reading is fetched then.
  const expiry = coordinator.nextExpiry();
  useEffect(() => {
    if (expiry === null) return;
    const delay = Math.max(0, expiry - Date.now()) + 50;
    const timer = window.setTimeout(() => {
      if (!document.hidden)
        void coordinator.refresh({ userID, calendar, securities, watchedIDs: watched ? watched.split(",") : [], hidesPersonalValues }, true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [coordinator, expiry, userID, calendar, securities, watched, hidesPersonalValues]);

  return null;
}
