"use client";

import { createContext, type ReactNode, useContext, useEffect, useState, useSyncExternalStore } from "react";

import { publicEnv } from "@/config/public-env";
import { browserConnectivity, observeConnectivity } from "@/data/market/connectivity";
import { listenToQuoteAnnouncements } from "@/data/market/realtime";
import { SupabaseMarketRepository, type SnapshotSource } from "@/data/market/repository";
import { routeSnapshotSource } from "@/data/market/route-source";
import { MarketStore, type MarketStoreState } from "@/data/market/store";
import { appErrors } from "@/features/errors/error-presenter";

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

let tabStore: MarketStore | undefined;

/** One market store per browser tab, created on first use. */
function marketStoreForTab(scenario: string | undefined): MarketStore {
  if (tabStore) return tabStore;
  const demo = publicEnv.dataMode === "demo";
  const source = routeSnapshotSource(demo ? scenario : undefined);
  const repository = new SupabaseMarketRepository({
    snapshot: demo && scenario === "offline" ? offlineAfterFirstLoad(source) : source,
    supabase: demo ? undefined : loadClient,
  });
  tabStore = new MarketStore({ repository, errors: appErrors });
  return tabStore;
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
