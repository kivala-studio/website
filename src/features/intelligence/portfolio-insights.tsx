"use client";

import { useState } from "react";

import type { Insight } from "@/domain/intelligence/models";
import type { PortfolioTransaction } from "@/domain/portfolio/models";
import { usePrivacyMode } from "@/features/privacy/privacy-mode";
import { Dialog } from "@/ui/components/dialog";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { type PortfolioSection, type PortfolioTile, portfolioTiles } from "./presentation";
import { useIntelligence, usePortfolioReading } from "./reading";
import { useTranslate } from "./watchlist-insights";

/** The weekly reading above the selected tab (iOS `PortfolioInsightTiles`): at most two tiles, none in privacy mode. */
export function PortfolioInsights({ transactions, section }: { transactions: readonly PortfolioTransaction[]; section: PortfolioSection }) {
  const t = useTranslate();
  const format = useFormat();
  const hides = usePrivacyMode();
  const intelligence = useIntelligence();
  const reading = usePortfolioReading(transactions);
  const [open, setOpen] = useState<PortfolioTile | null>(null);
  const tiles = portfolioTiles(reading.insights, section, hides, format, t);
  if (!intelligence || hides || (tiles.length === 0 && !open)) return null;
  const show = (tile: PortfolioTile) => {
    setOpen(tile);
    void intelligence.coordinator.consume(tile.insight, "portfolio");
  };

  return (
    <section aria-label={t("common.weeklyReview")} className="flex flex-col gap-2" data-testid="portfolio-reading">
      {reading.savedAt !== null ? (
        <p className="text-caption text-secondary-text">{t("intelligence.cachedInsight.savedNotice", { arg1: format.timestamp(reading.savedAt) })}</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => show(tile)}
            data-testid="portfolio-insight"
            data-tile={tile.id}
            className="flex min-h-11 flex-col items-start gap-1 rounded-large border-[length:var(--card-outline-width)] border-card-outline bg-card-background p-4 text-left"
          >
            <span className="text-caption text-secondary-text">{tile.title}</span>
            <span className="text-headline text-primary-text tabular-nums">{tile.value}</span>
            <span className="text-caption text-secondary-text">{tile.context}</span>
          </button>
        ))}
      </div>
      {open ? <PortfolioInsightDetail tile={open} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

/** "Detalhe da carteira" (iOS `PortfolioInsightDetails`): the positions behind a tile, the closes it used and its limits. */
function PortfolioInsightDetail({ tile, onClose }: { tile: PortfolioTile; onClose: () => void }) {
  const t = useTranslate();
  const format = useFormat();
  const hides = usePrivacyMode();
  const fact = tile.insight.fact;

  return (
    <Dialog open onClose={onClose} title={t("portfolio.insightDetails.title")}>
      <div className="flex flex-col gap-6" data-testid="portfolio-insight-detail">
        {hides ? (
          <p className="text-body text-primary-text">{t("portfolio.insightDetails.privacyHidden")}</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-caption font-medium text-accent">{tile.title}</p>
              <p className="text-headline text-primary-text tabular-nums">{tile.value}</p>
              <p className="text-secondary text-secondary-text">{tile.context}</p>
            </div>
            {fact.kind === "portfolioAllocation" ? (
              <>
                <Table
                  title={t("portfolio.insightDetails.allocationAtClose")}
                  caption={t("portfolio.insightDetails.allocationCaption")}
                  rows={fact.value.positions.map((row) => ({
                    id: row.assetID,
                    label: row.symbol,
                    detail: `${format.quantity(row.quantity)} × ${format.price(row.price)}`,
                    value: format.currency(row.value, { digits: 2 }),
                    share: format.boundedPercent(row.percentage, { signed: false }),
                  }))}
                />
                {(fact.value.issuers?.length ?? 0) > 1 ? (
                  <Table
                    title={t("portfolio.insightDetails.byIssuer")}
                    rows={fact.value.issuers!.map((group) => ({
                      id: group.id,
                      label: group.name,
                      value: format.currency(group.value, { digits: 2 }),
                      share: format.boundedPercent(group.percentage, { signed: false }),
                    }))}
                  />
                ) : null}
              </>
            ) : fact.kind === "portfolioPerformance" ? (
              <Table
                title={t("portfolio.insightDetails.priceBasedChange")}
                caption={t("portfolio.insightDetails.constantQuantity")}
                rows={fact.value.positions.map((row) => ({
                  id: row.assetID,
                  label: row.symbol,
                  detail: `${format.currency(row.startValue, { digits: 2 })} → ${format.currency(row.endValue, { digits: 2 })}`,
                  value: format.currency(row.contribution, { digits: 2, signed: true }),
                  share: format.points(row.percentagePoints),
                }))}
              />
            ) : null}
            <Approximate insight={tile.insight} />
          </>
        )}
      </div>
    </Dialog>
  );
}

interface TableRow {
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
  readonly value: string;
  readonly share: string;
}

function Table({ title, caption, rows }: { title: string; caption?: string; rows: readonly TableRow[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-body font-semibold text-primary-text">{title}</h3>
      {caption ? <p className="text-caption text-secondary-text">{caption}</p> : null}
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.id} className="flex items-baseline justify-between gap-3 border-t border-separator py-2 text-secondary">
            <span className="flex min-w-0 flex-col">
              <span className="text-primary-text">{row.label}</span>
              {row.detail ? <span className="text-caption text-secondary-text tabular-nums">{row.detail}</span> : null}
            </span>
            <span className="flex flex-col items-end tabular-nums">
              <span className="text-primary-text">{row.value}</span>
              <span className="text-caption text-secondary-text">{row.share}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Approximate({ insight }: { insight: Insight }) {
  const t = useTranslate();
  const format = useFormat();
  return (
    <>
      <section className="flex flex-col gap-1 rounded-medium bg-warning/10 p-3">
        <p className="flex items-center gap-2 text-secondary font-semibold text-primary-text">
          <Icon name="info" />
          {t("portfolio.insightDetails.approximateTitle")}
        </p>
        <p className="text-caption text-secondary-text">{t("portfolio.insightDetails.approximateMessage")}</p>
      </section>
      <details className="group flex flex-col gap-2" data-testid="portfolio-insight-sources">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-body font-semibold text-primary-text">
          {t("portfolio.insightDetails.sourcesTitle")}
          <Icon name="chevron-down" className="transition-transform group-open:rotate-180" />
        </summary>
        <p className="text-caption text-secondary-text">{t("portfolio.insightDetails.sourcesRecords")}</p>
        <p className="text-caption text-secondary-text">{t("portfolio.insightDetails.sourcesExclusions")}</p>
      </details>
      <p className="text-caption text-secondary-text">
        {t("portfolio.insightDetails.observedOn", { arg1: format.timestamp(insight.provenance.fetchedAt) })} {t("portfolio.insightDetails.notLive")}
      </p>
    </>
  );
}
