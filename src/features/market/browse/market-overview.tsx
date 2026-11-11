"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { type MarketSecurity, hasUsableQuote, hasUsableStatistics, isSameDay, kindLabelKey, marketMovers, securityDisplayName, visibleOutsideSearch } from "@/domain/market";
import { useMarketState } from "@/features/market/market-provider";
import { Link } from "@/i18n/navigation";
import { MarketStatusIndicator } from "@/ui/components/financial";
import { Dialog } from "@/ui/components/dialog";
import { SecurityLogo } from "@/ui/components/rows";
import { InstrumentRowSkeleton } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { type CatalogueRow, PriceCell } from "./price-cell";

function useLoadedSnapshot() {
  const state = useMarketState();
  return state.load.kind === "loaded" && state.assessedAt !== undefined ? { snapshot: state.load.snapshot, at: state.assessedAt } : undefined;
}

/** Status and "Publicado …", once the browser has the snapshot. */
export function SessionStatus() {
  const t = useTranslations();
  const format = useFormat();
  const loaded = useLoadedSnapshot();
  if (!loaded) return <span aria-hidden className="min-h-5" />;
  const published = loaded.snapshot.sourceMetadata?.publishedAt;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <MarketStatusIndicator status={loaded.snapshot.status} />
      <span className="text-caption text-tertiary-text">
        {published !== undefined ? t("markets.header.published", { arg1: format.timestamp(published) }) : t("markets.header.publishedUnavailable")}
      </span>
    </div>
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
  const facts = [
    [t("markets.summary.tradedSecurities"), usable ? format.chartAxis(loaded.snapshot.sessionVolume) : "—"],
    [t("markets.summary.transactions"), usable ? format.count(loaded.snapshot.trades) : "—"],
    [t("markets.summary.verifiedTraded"), verifiedTraded !== undefined ? format.count(verifiedTraded) : "—"],
  ];
  return (
    <dl className="grid grid-cols-1 gap-4 min-[22rem]:grid-cols-3">
      {facts.map(([title, value]) => (
        <div key={title} className="flex flex-col gap-1">
          <dt className="text-caption text-secondary-text">{title}</dt>
          <dd className="text-body font-semibold text-primary-text">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MoverList({ title, empty, securities, rows, at }: { title: string; empty: string; securities: MarketSecurity[] | undefined; rows: Map<string, CatalogueRow>; at: number }) {
  const t = useTranslations();
  const translate = (key: string) => t(key as never);
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-1">
      <h3 className="text-secondary font-semibold text-primary-text">{title}</h3>
      {securities === undefined ? (
        <div aria-busy>
          <InstrumentRowSkeleton />
          <InstrumentRowSkeleton />
          <InstrumentRowSkeleton />
        </div>
      ) : securities.length === 0 ? (
        <p className="py-3 text-secondary text-secondary-text">{empty}</p>
      ) : (
        <ul className="flex flex-col">
          {securities.map((security) => {
            const row = rows.get(security.id);
            return (
              <li key={security.id} className="border-b border-separator last:border-b-0">
                <Link href={`/mercado/${encodeURIComponent(security.symbol)}`} prefetch={false} className="flex min-h-18 items-center gap-3 rounded-small py-2">
                  <SecurityLogo symbol={security.symbol} logoUrl={row?.logoURL ?? security.logoURL} brandColor={row?.bond ? "violet" : "blue"} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-body font-semibold text-primary-text">{security.symbol}</span>
                    <span className="truncate text-caption text-secondary-text">{securityDisplayName(security) ?? translate(kindLabelKey(security.kind))}</span>
                  </span>
                  <PriceCell row={row} security={security} at={at} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Top 3 gains and losses by the displayed BODIVA variation (iOS home movers). */
export function Movers({ rows }: { rows: CatalogueRow[] }) {
  const t = useTranslations();
  const state = useMarketState();
  const loaded = useLoadedSnapshot();
  const byID = new Map(rows.map((row) => [row.id, row]));
  const movers = loaded ? marketMovers(loaded.snapshot.securities, loaded.at, 3) : undefined;
  const failed = state.load.kind === "failed";
  return (
    <section aria-labelledby="movers" className="flex flex-col gap-3">
      <h2 id="movers" className="text-section text-primary-text">
        {t("home.movers.header")}
      </h2>
      {failed ? (
        <p className="text-secondary text-secondary-text">{t("home.movers.quotesUnavailable")}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <MoverList title={t("home.movers.topGainers")} empty={t("home.movers.noGains")} securities={movers?.gains} rows={byID} at={loaded?.at ?? 0} />
          <MoverList title={t("home.movers.topLosers")} empty={t("home.movers.noDeclines")} securities={movers?.losses} rows={byID} at={loaded?.at ?? 0} />
        </div>
      )}
    </section>
  );
}
