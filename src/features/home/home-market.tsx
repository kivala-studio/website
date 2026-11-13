"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useMemo, useState } from "react";

import type { MarketStoreState } from "@/data/market/store";
import {
  type MarketSecurity,
  type MarketSnapshot,
  hasUsableQuote,
  hasUsableStatistics,
  kindLabelKey,
  marketMovers,
  securityDisplayName,
  visibleOutsideSearch,
} from "@/domain/market";
import { useAccount } from "@/features/account/account-provider";
import { type CatalogueRow, PriceCell } from "@/features/market/browse/price-cell";
import { useMarketState, useMarketStore } from "@/features/market/market-provider";
import { HomeMarketUpdates } from "@/features/news/market-information";
import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { Button, ButtonLink, IconButton } from "@/ui/components/buttons";
import { OptionGroup } from "@/ui/components/controls";
import { ChangeBadge, MarketStatusIndicator } from "@/ui/components/financial";
import { Card, SectionHeader } from "@/ui/components/layout";
import { SecurityLogo } from "@/ui/components/rows";
import { ErrorState, InstrumentRowSkeleton, Skeleton } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { MarketSessionSheet } from "./market-session-sheet";

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
  /** The context slot (at most one item; empty for now except a listing highlight). */
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
          className={cn(state.isRefreshing && "motion-spin")}
          data-testid="home-refresh"
        />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-6" aria-busy={state.load.kind === "loading" || undefined}>
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
          {context ? <div className="max-lg:order-3">{context}</div> : null}
          {failed ? null : (
            <div className="max-lg:order-4">
              <MovementFeed loaded={loaded} rows={byID} />
            </div>
          )}
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          {failed ? null : (
            <div className="max-lg:order-2">
              <WatchlistRail loaded={loaded} rows={byID} />
            </div>
          )}
          <div className="max-lg:order-5">{news}</div>
          <div className="empty:hidden max-lg:order-6">
            <HomeMarketUpdates />
          </div>
          {recaps ? <div className="max-lg:order-7">{recaps}</div> : null}
          <div className="max-lg:order-8">{simulator}</div>
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
    <Card className="flex flex-col gap-5" data-testid="home-overview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-section text-primary-text">{t("home.overview.header")}</h2>
        <MarketStatusIndicator status={snapshot.status} />
      </div>
      {hasIndex ? (
        <div className="flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-caption text-secondary-text">{t("common.appIndicator")}</span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-headline text-primary-text tabular-nums" data-testid="home-index">
                {format.number(index.value!, { digits: 2 })}
              </span>
              {index.percentageChange ? <ChangeBadge value={index.percentageChange} /> : null}
            </span>
            <span className="text-caption text-tertiary-text">{t("market.index.closesOn", { arg1: format.date(index.tradingDate!) })}</span>
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
              <span className="text-caption text-tertiary-text">{t("home.overview.tradedSecurities")}</span>
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
  );
}

/** The last 30 index points, accent line, no axes (decorative: the value beside it is the information). */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const lower = Math.min(...values);
  const span = Math.max(...values) - lower || 1;
  const path = values.map((value, index) => `${index === 0 ? "M" : "L"}${((index / (values.length - 1)) * 100).toFixed(2)} ${(60 - ((value - lower) / span) * 56).toFixed(2)}`).join(" ");
  return (
    <svg aria-hidden viewBox="0 0 100 64" className="h-16 w-25 shrink-0 overflow-visible text-accent" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function InstrumentLink({ security, row, at }: { security: MarketSecurity; row: CatalogueRow | undefined; at: number }) {
  const t = useTranslations();
  return (
    <Link href={`/mercado/${encodeURIComponent(security.symbol)}`} prefetch={false} className="flex min-h-18 items-center gap-3 rounded-small py-2 desk:min-h-12">
      <SecurityLogo symbol={security.symbol} logoUrl={row?.logoURL ?? security.logoURL} brandColor={row?.bond ? "violet" : "blue"} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-body font-semibold text-primary-text">{security.symbol}</span>
        <span className="truncate text-caption text-secondary-text">{securityDisplayName(security) ?? t(kindLabelKey(security.kind) as never)}</span>
      </span>
      <PriceCell row={row} security={security} at={at} />
    </Link>
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
    <section aria-labelledby="home-watchlist" className="flex flex-col gap-3 lg:panel lg:gap-1 lg:px-4 lg:py-3" data-testid="home-watchlist">
      <SectionHeader
        id="home-watchlist"
        title={t("common.yourWatchlist")}
        action={
          ids.length > 0 ? (
            <Link href="/lista" aria-label={t("home.accessibility.viewWatchlist")} className="inline-flex size-11 items-center justify-center rounded-full text-accent">
              <Icon name="arrow-right" />
            </Link>
          ) : null
        }
      />
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
        <ul className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-col lg:gap-0 lg:overflow-visible">
          {securities.map((security) => {
            const row = rows.get(security.id);
            return (
              <li key={security.id} className="w-44 shrink-0 snap-start rounded-[1.5rem] bg-card-background p-4 lg:w-auto lg:rounded-none lg:border-b lg:border-hairline lg:bg-transparent lg:p-0 lg:last:border-b-0">
                <RailTile security={security} row={row} at={loaded!.at} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RailTile({ security, row, at }: { security: MarketSecurity; row: CatalogueRow | undefined; at: number }) {
  const t = useTranslations();
  return (
    <>
      <Link
        href={`/mercado/${encodeURIComponent(security.symbol)}`}
        prefetch={false}
        className="flex flex-col gap-3 rounded-small lg:hidden"
      >
        <SecurityLogo symbol={security.symbol} logoUrl={row?.logoURL ?? security.logoURL} brandColor={row?.bond ? "violet" : "blue"} size="s" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-body font-semibold text-primary-text">{security.symbol}</span>
          <span className="truncate text-caption text-secondary-text">{t(kindLabelKey(security.kind) as never)}</span>
        </span>
        <PriceCell row={row} security={security} at={at} className="items-start" />
      </Link>
      <div className="max-lg:hidden">
        <InstrumentLink security={security} row={row} at={at} />
      </div>
    </>
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
    <section aria-labelledby="home-movement" className="flex flex-col gap-3 lg:panel lg:p-4" data-testid="home-movement">
      <SectionHeader id="home-movement" title={t("common.onTheMove")} />
      <OptionGroup
        label={t("common.onTheMove")}
        value={tab}
        onChange={(value) => setTab(value as FeedTab)}
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
        <p className="py-3 text-secondary text-secondary-text">{t(feed!.hasQuotes ? "home.movers.emptyCategory" : "home.movers.quotesUnavailable")}</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((security, index) => (
            <li key={security.id} className={cn("border-b border-separator last:border-b-0 lg:border-hairline", index >= 3 && "max-lg:hidden")}>
              <InstrumentLink security={security} row={rows.get(security.id)} at={loaded!.at} />
            </li>
          ))}
        </ul>
      )}
      <ButtonLink href="/mercado" kind="secondary" className="self-start lg:w-auto">
        {t("home.explore.header")}
      </ButtonLink>
    </section>
  );
}
