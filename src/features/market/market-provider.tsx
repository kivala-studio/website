"use client";

import { createContext, type ReactNode, useContext, useEffect, useState, useSyncExternalStore } from "react";

import { publicEnv } from "@/config/public-env";
import { browserConnectivity, observeConnectivity } from "@/data/market/connectivity";
import { routeHistorySource } from "@/data/market/history-wire";
import { listenToQuoteAnnouncements } from "@/data/market/realtime";
import { SupabaseMarketRepository, type SnapshotSource } from "@/data/market/repository";
import { demoMarketUpdates } from "@/data/market/demo/updates";
import { routeSnapshotSource } from "@/data/market/route-source";
import { MarketStore, type MarketStoreState } from "@/data/market/store";
import { ErrorPresenter, appErrors } from "@/features/errors/error-presenter";
import { ToastHost } from "@/ui/components/feedback";

const loadClient = () => import("@/data/supabase/browser-client").then((module) => module.browserSupabase());

/**
 * Demo `offline`: the first snapshot loads, then the connection is treated as lost (every request
 * fails as a dropped connection would).
 */
function offlineAfterFirstLoad(source: SnapshotSource): SnapshotSource {
  let served = false;
  return async (signal) => {
    if (served) throw new TypeError("Failed to fetch");
    const response = await source(signal);
    served = true;
    return response;
  };
}

/** The demo scenario the snapshot route also reads (`DEMO_SCENARIO_COOKIE`; that module carries the recorded snapshot). */
const cookieScenario = () =>
  typeof document === "undefined" ? undefined : document.cookie.split("; ").find((item) => item.startsWith("demo-scenario="))?.slice("demo-scenario=".length);

let tabStore: MarketStore | undefined;

/** One market store per browser tab, created on first use. */
function marketStoreForTab(scenario: string | undefined): MarketStore {
  if (tabStore) return tabStore;
  const server = typeof window === "undefined";
  const demo = publicEnv.dataMode === "demo";
  const source = routeSnapshotSource(demo ? scenario : undefined);
  const repository = new SupabaseMarketRepository({
    snapshot: demo && scenario === "offline" ? offlineAfterFirstLoad(source) : source,
    supabase: demo ? undefined : loadClient,
    history: routeHistorySource,
    updates: demo && (scenario ?? cookieScenario()) === "updates" ? demoMarketUpdates(Date.now()) : undefined,
  });
  const store = new MarketStore({ repository, errors: appErrors });
  // Server rendering gets an idle store per request: it never loads, and it is never shared between visitors.
  if (!server) tabStore = store;
  return store;
}

/** Sign-out and session expiry: the tab's store forgets everything and pending results are discarded. */
export function resetTabMarketStore(): void {
  tabStore?.reset();
}

const MarketStoreContext = createContext<MarketStore | null>(null);

export function useMarketStore(): MarketStore {
  const store = useContext(MarketStoreContext);
  if (!store) throw new Error("useMarketStore needs a <MarketProvider> ancestor");
  return store;
}

export function useMarketState(): MarketStoreState {
  const store = useMarketStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/**
 * Runs the tab's market store while mounted and visible: polling, connectivity and Realtime
 * announcements. Hiding the tab suspends it and revokes current quotes; showing it refreshes.
 */
export function MarketProvider({ children, scenario }: { children: ReactNode; scenario?: string }) {
  const parent = useContext(MarketStoreContext);
  return parent ? children : <RunningMarket scenario={scenario}>{children}</RunningMarket>;
}

/**
 * The market area of a page: toasts, the store and the error presenter. A page inside the signed-in shell
 * already has one; nesting adds nothing (one poll loop and one presenter per tab).
 */
export function MarketArea({ children, scenario }: { children: ReactNode; scenario?: string }) {
  const parent = useContext(MarketStoreContext);
  if (parent) return children;
  return (
    <ToastHost>
      <RunningMarket scenario={scenario}>
        <ErrorPresenter />
        {children}
      </RunningMarket>
    </ToastHost>
  );
}

function RunningMarket({ children, scenario }: { children: ReactNode; scenario?: string }) {
  const [store] = useState(() => marketStoreForTab(scenario));

  useEffect(() => {
    const mounted = new AbortController();
    let visible: AbortController | undefined;

    const show = () => {
      if (visible) return;
      const controller = new AbortController();
      visible = controller;
      void store.runAutomaticRefresh();
      if (publicEnv.dataMode === "demo") return;
      void loadClient().then((client) => {
        if (controller.signal.aborted) return;
        listenToQuoteAnnouncements(
          client,
          {
            onStatus: (connected) => store.setLiveFeed(connected),
            onAnnouncement: (announcement) => void store.applyQuoteAnnouncement(announcement),
          },
          controller.signal,
        );
      });
    };
    const hide = () => {
      visible?.abort();
      visible = undefined;
      store.setLiveFeed(false);
      store.suspend({ preservingContent: true });
    };
    const onVisibility = () => (document.hidden ? hide() : show());

    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) show();
    void observeConnectivity(browserConnectivity(mounted.signal), store, mounted.signal);
    const unsubscribe =
      publicEnv.dataMode === "demo" && scenario === "offline"
        ? store.subscribe(() => {
            if (store.getSnapshot().hasLoadedLiveSnapshot && !store.getSnapshot().isOffline) store.setConnectivity(true);
          })
        : undefined;

    return () => {
      unsubscribe?.();
      document.removeEventListener("visibilitychange", onVisibility);
      mounted.abort();
      hide();
    };
  }, [store, scenario]);

  return <MarketStoreContext.Provider value={store}>{children}</MarketStoreContext.Provider>;
}
