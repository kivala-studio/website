"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { type MarketSecurity, hasUsableQuote, hasUsableStatistics, isSameDay, marketMovers, visibleOutsideSearch } from "@/domain/market";
import { useMarketState } from "@/features/market/market-provider";
import { Link } from "@/i18n/navigation";
import { SegmentedControl } from "@/ui/components/controls";
import { MarketStatusIndicator } from "@/ui/components/financial";
import { Card, StatTile } from "@/ui/components/layout";
import { Dialog } from "@/ui/components/dialog";
import { SecurityLogo } from "@/ui/components/rows";
import { Skeleton } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { type CatalogueRow, ChangeCell, PriceCell } from "./price-cell";

function useLoadedSnapshot() {
  const state = useMarketState();
  return state.load.kind === "loaded" && state.assessedAt !== undefined ? { snapshot: state.load.snapshot, at: state.assessedAt } : undefined;
}

/** Estado da negociação with "Publicado …" under it, as a tile; "—" until the browser has the snapshot. */
export function SessionStatusTile({ className }: { className?: string }) {
  const t = useTranslations();
  const format = useFormat();
  const loaded = useLoadedSnapshot();
  const published = loaded?.snapshot.sourceMetadata?.publishedAt;
  return (
    <StatTile
      className={className}
      label={t("assetDetails.marketInfo.tradingStatus")}
      value={loaded ? <MarketStatusIndicator status={loaded.snapshot.status} size="value" /> : "—"}
      detail={
        loaded ? (published !== undefined ? t("markets.header.published", { arg1: format.timestamp(published) }) : t("markets.header.publishedUnavailable")) : undefined
      }
      data-testid="market-status"
    />
  );
}

/** Info button and the Indicador invest.ao methodology sheet (iOS `SyntheticIndexInfoSheet`, text verbatim). */
export function IndexInfo() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const name = t("common.appIndicator");
  const steps = (["base", "change", "weight", "cumulative"] as const).map((step) => ({
    title: t(`market.index.${step}Title`),
    description: t(`market.index.${step}Description`),
  }));
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("common.aboutItem", { arg1: name })}
        aria-haspopup="dialog"
        className="-my-3 inline-flex size-11 items-center justify-center rounded-full text-tertiary-text"
      >
        <Icon name="info" scale="s" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={name}>
        <div className="flex flex-col gap-6 px-5 pt-2 pb-8" data-testid="index-methodology">
          <div className="flex flex-col gap-3 rounded-large border border-separator bg-elevated-background p-4">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex size-11 items-center justify-center rounded-medium bg-accent text-on-accent">
                <Icon name="trend-up" scale="l" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-section text-primary-text">{name}</span>
                <span className="text-caption text-secondary-text">{t("market.index.subtitle")}</span>
              </span>
            </div>
            <span className="self-start rounded-full bg-accent/12 px-2 py-1 text-micro font-bold text-accent uppercase">
              {t("components.indexInfo.calculatedBy")}
            </span>
          </div>
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-section text-primary-text">
              <Icon name="info" />
              {t("components.indexInfo.whatItIs")}
            </h3>
            <p className="text-secondary text-secondary-text">{t("market.index.summary")}</p>
          </section>
          <section className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-section text-primary-text">
              <Icon name="calculator" />
              {t("components.indexInfo.howCalculated")}
            </h3>
            <p className="text-secondary text-secondary-text">{t("market.index.methodology")}</p>
            <p className="text-secondary text-secondary-text">{t("market.index.unavailableMessage")}</p>
            <ol className="flex flex-col gap-2 rounded-medium border border-separator bg-elevated-background p-4">
              {steps.map((step, index) => (
                <li key={step.title} className="flex items-start gap-3 py-1">
                  <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/14 text-caption font-bold text-accent">
                    {index + 1}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-secondary font-semibold text-primary-text">{step.title}</span>
                    <span className="text-caption text-secondary-text">{step.description}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-section text-primary-text">
              <Icon name="markets" />
              {t("components.indexInfo.dataSource")}
            </h3>
            <p className="text-secondary text-secondary-text">{t("market.index.dataSourceDisclosure")}</p>
          </section>
          <section className="flex flex-col gap-3 rounded-large border border-warning/25 bg-warning/8 p-4">
            <h3 className="flex items-center gap-2 text-section text-warning">
              <Icon name="shield-check" />
              {t("components.indexInfo.legalNotice")}
            </h3>
            <p className="text-caption text-secondary-text">{t("market.index.legalNotice")}</p>
          </section>
        </div>
      </Dialog>
    </>
  );
}

/** Títulos negociados · Transações · Negociados verificados; "—" unless the session statistics are usable. */
export function SessionFacts() {
  const t = useTranslations();
  const format = useFormat();
  const loaded = useLoadedSnapshot();
  const usable = loaded && hasUsableStatistics(loaded.snapshot, loaded.at);
  const tradingDate = loaded?.snapshot.sourceMetadata?.tradingDate;
  const verifiedTraded =
    usable && tradingDate !== undefined
      ? visibleOutsideSearch(loaded.snapshot.securities, loaded.at).filter(
          (security) =>
            hasUsableQuote(security, loaded.at) &&
            security.volume.gt(0) &&
            security.quoteTradingDate !== undefined &&
            isSameDay(security.quoteTradingDate, tradingDate),
        ).length
      : undefined;
  return (
    <dl className="grid h-full grid-cols-2 grid-rows-[auto_1fr] gap-3" data-testid="session-facts">
      <StatTile size="large" className="col-span-2" label={t("markets.summary.tradedSecurities")} value={usable ? format.chartAxis(loaded.snapshot.sessionVolume) : "—"} />
      <StatTile label={t("markets.summary.transactions")} value={usable ? format.count(loaded.snapshot.trades) : "—"} />
      <StatTile label={t("markets.summary.verifiedTraded")} value={verifiedTraded !== undefined ? format.count(verifiedTraded) : "—"} />
    </dl>
  );
}

const MOVER_LIMIT = 5;
type MoverTab = "gains" | "declines" | "volume";

function MoverRow({ security, row, at }: { security: MarketSecurity; row: CatalogueRow | undefined; at: number }) {
  return (
    <li className="border-b border-hairline last:border-b-0">
      <Link
        href={`/mercado/${encodeURIComponent(security.symbol)}`}
        prefetch={false}
        className="flex min-h-12 items-center gap-3 rounded-small py-1.5 desk:min-h-11"
      >
        <span className="flex shrink-0 max-[25rem]:hidden">
          <SecurityLogo symbol={security.symbol} logoUrl={row?.logoURL ?? security.logoURL} brandColor={row?.bond ? "violet" : "blue"} size="s" />
        </span>
        <span className="min-w-0 flex-1 truncate font-display font-medium text-primary-text">{security.symbol}</span>
        <PriceCell row={row} security={security} at={at} inlineChange="hidden!" compact />
        <span className="flex min-w-18 shrink-0 justify-end">
          <ChangeCell row={row} security={security} at={at} />
        </span>
      </Link>
    </li>
  );
}

/**
 * The movers card: Subidas · Descidas · Volume over five rows, among instruments with a usable current quote, so it
 * fills in only once the browser has the snapshot (gains and declines by the displayed BODIVA variation, iOS home
 * movers; volume as on the signed-in Home).
 */
export function MarketMovers({ rows }: { rows: CatalogueRow[] }) {
  const t = useTranslations();
  const state = useMarketState();
  const loaded = useLoadedSnapshot();
  const [tab, setTab] = useState<MoverTab>("gains");
  const byID = new Map(rows.map((row) => [row.id, row]));
  const label = t("home.movers.header");
  let items: MarketSecurity[] | undefined;
  let empty = "";
  if (loaded) {
    const { snapshot, at } = loaded;
    if (tab === "volume") {
      const usable = visibleOutsideSearch(snapshot.securities, at).filter((security) => hasUsableQuote(security, at));
      items = usable
        .filter((security) => security.volume.gt(0))
        .sort((a, b) => b.volume.comparedTo(a.volume) || a.symbol.localeCompare(b.symbol))
        .slice(0, MOVER_LIMIT);
      empty = t(usable.length > 0 ? "home.movers.emptyCategory" : "home.movers.quotesUnavailable");
    } else {
      const movers = marketMovers(snapshot.securities, at, MOVER_LIMIT);
      items = tab === "gains" ? movers.gains : movers.losses;
      empty = t(tab === "gains" ? "home.movers.noGains" : "home.movers.noDeclines");
    }
  }
  return (
    <Card role="region" aria-label={label} className="flex h-full flex-col gap-3" data-testid="market-movers">
      <SegmentedControl
        label={label}
        value={tab}
        onChange={setTab}
        options={[
          { value: "gains", title: t("home.movers.gainsTab") },
          { value: "declines", title: t("home.movers.declinesTab") },
          { value: "volume", title: t("markets.sort.volume") },
        ]}
      />
      {state.load.kind === "failed" ? (
        <p className="py-3 text-secondary text-secondary-text">{t("home.movers.quotesUnavailable")}</p>
      ) : items === undefined ? (
        <div aria-busy className="flex flex-col">
          {Array.from({ length: MOVER_LIMIT }, (_, index) => (
            <div key={index} aria-hidden className="flex min-h-12 items-center gap-3 desk:min-h-11">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <span className="flex-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-3 text-secondary text-secondary-text">{empty}</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((security) => (
            <MoverRow key={security.id} security={security} row={byID.get(security.id)} at={loaded!.at} />
          ))}
        </ul>
      )}
    </Card>
  );
}
