"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useMemo, useState } from "react";

import type { MarketStoreState } from "@/data/market/store";
import { type MarketSecurity, type MarketSnapshot, hasUsableQuote, hasUsableStatistics, marketMovers, visibleOutsideSearch } from "@/domain/market";
import { useAccount } from "@/features/account/account-provider";
import { CompactRow, MoverRow } from "@/features/market/browse/market-overview";
import { type CatalogueRow, PriceCell, rowFigure } from "@/features/market/browse/price-cell";
import { useMarketState, useMarketStore } from "@/features/market/market-provider";
import { HomeMarketUpdates } from "@/features/news/market-information";
import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { Button, ButtonLink, IconButton } from "@/ui/components/buttons";
import { SegmentedControl } from "@/ui/components/controls";
import { ChangeBadge, MarketStatusIndicator } from "@/ui/components/financial";
import { Card, Panel } from "@/ui/components/layout";
import { SeeAll } from "@/ui/components/see-all";
import { AnimatedText } from "@/ui/components/animated-value";
import { FlipList } from "@/ui/components/flip-list";
import { ErrorState, FadeIn, InstrumentRowSkeleton, Skeleton } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { MarketSessionSheet } from "./market-session-sheet";
import { PlusPrompt } from "./plus-prompt";

type Loaded = { snapshot: MarketSnapshot; at: number };

const loadedOf = (state: MarketStoreState): Loaded | undefined =>
  state.load.kind === "loaded" && state.assessedAt !== undefined ? { snapshot: state.load.snapshot, at: state.assessedAt } : undefined;

const RAIL_LIMIT = 6;
const NO_IDS: readonly string[] = [];
/** Movement rows: the top 3 on phones, more beside the wider layout. */
const FEED_LIMIT = 6;

/**
 * The market half of Home (iOS `HomeView` sections 1, 2 and 4, with the server's sections in between): one
 * market store, one account. Desktop puts the watchlist and the reading sections in a second column.
 */
export function HomeView({
  rows,
  context,
  news,
  recaps,
  simulator,
}: {
  rows: readonly CatalogueRow[];
  /** The context slot: at most one item. */
  context: ReactNode;
  news: ReactNode;
  recaps: ReactNode;
  simulator: ReactNode;
}) {
  const t = useTranslations();
  const state = useMarketState();
  const store = useMarketStore();
  const loaded = loadedOf(state);
  const byID = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const failed = !loaded && state.load.kind === "failed";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-display text-primary-text">{t("common.home")}</h1>
        <IconButton
          icon="refresh"
          label={t("common.refresh")}
          onClick={() => void store.load({ force: true })}
          disabled={state.isRefreshing}
          aria-busy={state.isRefreshing || undefined}
          className={cn(state.isRefreshing && "[&>svg]:motion-spin")}
          data-testid="home-refresh"
        />
      </div>
      <div
        className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
        aria-busy={state.load.kind === "loading" || undefined}
      >
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
          <div className="max-lg:order-1">
            {failed ? (
              <ErrorState
                title={t("errors.market.loadFailed")}
                message={t("common.checkConnectionMessage")}
                action={
                  <Button kind="secondary" onClick={() => void store.load({ force: true })}>
                    {t("common.tryAgain")}
                  </Button>
                }
              />
            ) : (
              <OverviewCard loaded={loaded} stale={state.refreshError !== null} />
            )}
          </div>
          {/* Under the overview, so the index never moves when the prompt arrives after the plans are read. */}
          <div className="empty:hidden max-lg:order-2">
            <PlusPrompt />
          </div>
          <div className="empty:hidden max-lg:order-4">{context}</div>
          {failed ? null : (
            <div className="max-lg:order-5">
              <MovementFeed loaded={loaded} rows={byID} />
            </div>
          )}
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-6">
          {failed ? null : (
            <div className="max-lg:order-3">
              <WatchlistRail loaded={loaded} rows={byID} />
            </div>
          )}
          <div className="max-lg:order-6">{news}</div>
          <div className="empty:hidden max-lg:order-7">
            <HomeMarketUpdates />
          </div>
          {recaps ? <div className="max-lg:order-8">{recaps}</div> : null}
          <div className="max-lg:order-9">{simulator}</div>
        </div>
      </div>
    </div>
  );
}

/** Section 1, the one card on Home. */
function OverviewCard({ loaded, stale }: { loaded: Loaded | undefined; stale: boolean }) {
  const t = useTranslations();
  const format = useFormat();
  const [open, setOpen] = useState(false);
  if (!loaded) {
    return (
      <Card aria-label={t("home.accessibility.loadingMarket")} className="flex flex-col gap-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-11 w-full" />
      </Card>
    );
  }
  const { snapshot, at } = loaded;
  const index = snapshot.index;
  const hasIndex = index.value !== undefined && index.tradingDate !== undefined;
  const statistics = hasUsableStatistics(snapshot, at);
  const visible = visibleOutsideSearch(snapshot.securities, at);
  const verifiedCloses = visible.filter((security) => security.closingPrice !== undefined).length;
  return (
    <FadeIn>
      <Card
        title={t("home.overview.header")}
        titleId="home-overview-title"
        action={<MarketStatusIndicator status={snapshot.status} />}
        bodyClassName="flex flex-col gap-5"
        data-testid="home-overview"
      >
        {hasIndex ? (
          <div className="flex items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-caption text-secondary-text">{t("common.appIndicator")}</span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-headline text-primary-text tabular-nums" data-testid="home-index">
                  <AnimatedText text={format.number(index.value!, { digits: 2 })} numeric={index.value!.toString()} className="inline-block" />
                </span>
                {index.percentageChange ? <ChangeBadge value={index.percentageChange} /> : null}
              </span>
              <span className="text-caption text-secondary-text">{t("market.index.closesOn", { arg1: format.date(index.tradingDate!) })}</span>
            </div>
            <Sparkline values={index.history.slice(-30).map((point) => point.value.toNumber())} />
          </div>
        ) : null}
        {statistics ? (
          <dl className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <dt className="text-caption text-secondary-text">{t("home.overview.sessionVolume")}</dt>
              <dd className="flex flex-col">
                <span className="text-section text-primary-text tabular-nums">{format.count(snapshot.sessionVolume)}</span>
                <span className="text-caption text-secondary-text">{t("home.overview.tradedSecurities")}</span>
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-caption text-secondary-text">{t("common.trades")}</dt>
              <dd className="text-section text-primary-text tabular-nums">{format.count(snapshot.trades)}</dd>
            </div>
          </dl>
        ) : hasIndex ? (
          <p className="text-secondary text-secondary-text">{t("home.overview.noVerifiedTotals")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-secondary text-secondary-text">
                {t(verifiedCloses > 0 ? "home.overview.verifiedCloses" : "home.overview.availableInstruments")}
              </span>
              <span className="text-section text-primary-text tabular-nums">{format.count(verifiedCloses > 0 ? verifiedCloses : visible.length)}</span>
            </p>
            <p className="text-secondary text-secondary-text">{t("home.overview.noVerifiedData")}</p>
          </div>
        )}
        {stale ? <p className="text-caption text-warning">{t("home.summary.staleData")}</p> : null}
        <div className="border-t border-separator pt-1 lg:border-hairline">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-small text-secondary font-semibold text-accent"
            data-testid="home-market-details"
          >
            {t("home.overview.viewDetails")}
            <Icon name="chevron-right" />
          </button>
        </div>
        <MarketSessionSheet open={open} onClose={() => setOpen(false)} loaded={loaded} />
      </Card>
    </FadeIn>
  );
}

/** The last 30 index points, accent line, no axes (decorative: the value beside it is the information). */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const lower = Math.min(...values);
  const span = Math.max(...values) - lower || 1;
  const path = values
    .map((value, index) => `${index === 0 ? "M" : "L"}${((index / (values.length - 1)) * 100).toFixed(2)} ${(60 - ((value - lower) / span) * 56).toFixed(2)}`)
    .join(" ");
  return (
    <svg aria-hidden viewBox="0 0 100 64" className="h-16 w-25 shrink-0 overflow-visible text-accent" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Section 2: up to six watched instruments in saved order, or the way to start a list. */
function WatchlistRail({ loaded, rows }: { loaded: Loaded | undefined; rows: Map<string, CatalogueRow> }) {
  const t = useTranslations();
  const ids = useAccount()?.watchlist ?? NO_IDS;
  const securities = useMemo(() => {
    if (!loaded) return undefined;
    const byID = new Map(loaded.snapshot.securities.map((security) => [security.id, security]));
    return ids.flatMap((id) => byID.get(id) ?? []).slice(0, RAIL_LIMIT);
  }, [ids, loaded]);
  return (
    <Panel
      title={t("common.yourWatchlist")}
      titleId="home-watchlist"
      data-testid="home-watchlist"
      action={ids.length > 0 ? <SeeAll href="/lista" /> : null}
    >
      {ids.length === 0 ? (
        <Link href="/pesquisa" className="flex min-h-18 items-center gap-4 rounded-large bg-accent/10 p-4 text-accent">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
            <Icon name="add" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-body font-semibold">{t("home.watchlist.emptyTitle")}</span>
            <span className="text-caption text-secondary-text">{t("home.watchlist.emptyMessage")}</span>
          </span>
        </Link>
      ) : securities === undefined ? (
        <div>
          {ids.slice(0, 3).map((id) => (
            <InstrumentRowSkeleton key={id} />
          ))}
        </div>
      ) : (
        <FadeIn>
          <FlipList className="flex flex-col">
            {securities.map((security) => {
              const row = rows.get(security.id);
              return (
                <CompactRow key={security.id} security={security} row={row}>
                  <RowFigures security={security} row={row} at={loaded!.at} />
                </CompactRow>
              );
            })}
          </FlipList>
        </FadeIn>
      )}
    </Panel>
  );
}

type FeedTab = "gains" | "declines" | "volume";

/** Section 4: gains, declines or volume among instruments with a usable current quote. */
function MovementFeed({ loaded, rows }: { loaded: Loaded | undefined; rows: Map<string, CatalogueRow> }) {
  const t = useTranslations();
  const [tab, setTab] = useState<FeedTab>("gains");
  const feed = useMemo(() => {
    if (!loaded) return undefined;
    const { snapshot, at } = loaded;
    const visible = visibleOutsideSearch(snapshot.securities, at);
    const usable = visible.filter((security) => hasUsableQuote(security, at));
    const movers = marketMovers(visible, at, FEED_LIMIT);
    const volume = usable
      .filter((security) => security.volume.gt(0))
      .sort((a, b) => b.volume.comparedTo(a.volume) || a.symbol.localeCompare(b.symbol))
      .slice(0, FEED_LIMIT);
    return { hasQuotes: usable.length > 0, items: { gains: movers.gains, declines: movers.losses, volume } };
  }, [loaded]);
  const items = feed?.items[tab];
  return (
    <Panel
      title={t("common.onTheMove")}
      titleId="home-movement"
      data-testid="home-movement"
      action={
        <ButtonLink href="/mercado" kind="outline" size="compact">
          {t("home.explore.header")}
        </ButtonLink>
      }
    >
      <SegmentedControl
        label={t("common.onTheMove")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "gains", title: t("home.movers.gainsTab") },
          { value: "declines", title: t("home.movers.declinesTab") },
          { value: "volume", title: t("markets.sort.volume") },
        ]}
      />
      {items === undefined ? (
        <div aria-label={t("home.accessibility.loadingMovements")}>
          <InstrumentRowSkeleton />
          <InstrumentRowSkeleton />
          <InstrumentRowSkeleton />
        </div>
      ) : items.length === 0 ? (
        <FadeIn key={tab}>
          <p className="py-3 text-secondary text-secondary-text">{t(feed!.hasQuotes ? "home.movers.emptyCategory" : "home.movers.quotesUnavailable")}</p>
        </FadeIn>
      ) : (
        // Another tab or snapshot: rows that stay glide to their places, new ones fade in.
        <FadeIn>
          <FlipList className="flex flex-col">
            {items.map((security, index) => {
              const row = rows.get(security.id);
              return (
                <MoverRow key={security.id} security={security} row={row} at={loaded!.at} volume={tab === "volume"} className={cn(index >= 3 && "max-lg:hidden")} />
              );
            })}
          </FlipList>
        </FadeIn>
      )}
    </Panel>
  );
}

/** The movers card's figures: the price (or dated close), then the change badge, shown only beside a current price. */
function RowFigures({ security, row, at }: { security: MarketSecurity; row: CatalogueRow | undefined; at: number }) {
  const figure = rowFigure(row, security, at);
  return (
    <>
      <PriceCell row={row} security={security} at={at} inlineChange="hidden!" compact />
      <span className="flex min-w-18 shrink-0 justify-end">
        {figure.kind === "current" && figure.change !== undefined ? <ChangeBadge value={figure.change} /> : <span aria-hidden className="text-tertiary-text">—</span>}
      </span>
    </>
  );
}
