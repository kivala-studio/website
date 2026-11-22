"use client";

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { MarketOverviewSkeleton } from "@/features/market/browse/market-skeleton";
import { InstrumentSkeleton } from "@/features/market/instrument/instrument-skeleton";
import { PortfolioRail } from "@/features/portfolio/portfolio-rail";
import { usePathname, usePendingPathname } from "@/i18n/navigation";

import {
  ActivitySkeleton,
  AdmissionSkeleton,
  DeleteAccountSkeleton,
  HomeSkeleton,
  LandingSkeleton,
  LessonsSkeleton,
  MARKET_PAGE,
  MarketInformationSkeleton,
  NewsFeedSkeleton,
  PlansSkeleton,
  PORTFOLIO_PAGE,
  PortfolioSkeleton,
  PrivacyPolicySkeleton,
  ReadingSkeleton,
  RecapSkeleton,
  SearchSkeleton,
  SettingsSkeleton,
  SimulatorSkeleton,
  SupportSkeleton,
  TermsSkeleton,
  UnusualActivitySkeleton,
  WatchlistSkeleton,
  WeekSkeleton,
} from "./route-skeletons";

const market = (page: ReactNode) => (
  <main id="main" className={MARKET_PAGE}>
    {page}
  </main>
);

/** Each route's `loading.tsx` as it renders under the area layout (first match wins); any other page reads as text. */
const ROUTES: readonly (readonly [RegExp, () => ReactNode])[] = [
  [/^\/$/, () => <LandingSkeleton />],
  [/^\/aprender$/, () => <LessonsSkeleton />],
  [/^\/noticias$/, () => <NewsFeedSkeleton />],
  [/^\/eliminar-conta$/, () => <DeleteAccountSkeleton />],
  [/^\/policy$/, () => <PrivacyPolicySkeleton />],
  [/^\/suporte$/, () => <SupportSkeleton />],
  [/^\/termos$/, () => <TermsSkeleton />],
  [/^\/mercado$/, () => market(<MarketOverviewSkeleton />)],
  [/^\/mercado\/informacao(\/|$)/, () => market(<MarketInformationSkeleton />)],
  [/^\/mercado\/admissao\/[^/]+$/, () => market(<AdmissionSkeleton />)],
  [/^\/mercado\/[^/]+$/, () => market(<InstrumentSkeleton />)],
  [/^\/inicio$/, () => <HomeSkeleton />],
  [/^\/lista$/, () => <WatchlistSkeleton />],
  [
    /^\/carteira(\/|$)/,
    () => (
      <div className={PORTFOLIO_PAGE}>
        <PortfolioRail />
        <PortfolioSkeleton />
      </div>
    ),
  ],
  [/^\/atividade$/, () => <ActivitySkeleton />],
  [/^\/atividade-invulgar$/, () => <UnusualActivitySkeleton />],
  [/^\/definicoes(\/|$)/, () => <SettingsSkeleton />],
  [/^\/pesquisa$/, () => <SearchSkeleton />],
  [/^\/planos$/, () => <PlansSkeleton />],
  [/^\/semana$/, () => <WeekSkeleton />],
  [/^\/simulador$/, () => <SimulatorSkeleton />],
  [/^\/wrap\/[^/]+$/, () => <RecapSkeleton />],
];

const skeletonFor = (path: string) => (ROUTES.find(([pattern]) => pattern.test(path))?.[1] ?? (() => <ReadingSkeleton />))();

/**
 * An area layout's page slot. A link to a page that was not prefetched waits for the server before the router
 * shows the page's `loading.tsx`; meanwhile this shows the same skeleton in the outgoing page's place, two frames
 * after the press, with the scroll at the top. The outgoing page stays mounted, hidden, so a navigation that ends
 * elsewhere (Back, a redirect to the same page) shows it again where it was. When the router commits, the page or its own skeleton takes the slot in the same frame.
 */
export function PendingPage({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pending = usePendingPathname();
  const target = pending !== null && pending !== pathname ? pending : null;
  const [shown, setShown] = useState(false);
  if (shown && target === null) setShown(false);

  // Two frames after the press reached this slot: a page the router has in its cache is there by then.
  useEffect(() => {
    if (target === null || shown) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => flushSync(() => setShown(true)));
    });
    return () => cancelAnimationFrame(frame);
  }, [target, shown]);

  const showing = shown && target !== null ? target : null;
  const origin = useRef<{ path: string; y: number } | null>(null);
  useLayoutEffect(() => {
    if (showing !== null && origin.current === null) {
      origin.current = { path: pathname, y: window.scrollY };
      window.scrollTo(0, 0);
    } else if (showing === null && origin.current !== null) {
      if (origin.current.path === pathname) window.scrollTo(0, origin.current.y);
      origin.current = null;
    }
  }, [showing, pathname]);

  return (
    <>
      {showing !== null ? skeletonFor(showing) : null}
      <div className={showing !== null ? "hidden" : "contents"}>{children}</div>
    </>
  );
}
