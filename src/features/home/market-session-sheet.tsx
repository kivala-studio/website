"use client";

import type Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  type MarketSnapshot,
  TIME_RANGE_LINE_WIDTH,
  hasUsableStatistics,
  isRangeAvailable,
  marketMovers,
  rangePoints,
  visibleOutsideSearch,
} from "@/domain/market";
import { useAccount } from "@/features/account/account-provider";
import { PriceChart } from "@/features/chart/price-chart";
import { RANGE_NAMES, RANGE_OF } from "@/features/chart/ranges";
import { IndexInfo } from "@/features/market/browse/market-overview";
import { cn } from "@/ui/cn";
import { type TimeRange as RangeName, TimeRangePicker } from "@/ui/components/controls";
import { Dialog } from "@/ui/components/dialog";
import { MarketStatusIndicator } from "@/ui/components/financial";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

const tone = (value: Decimal | undefined) =>
  value === undefined || value.isZero() ? "text-secondary-text" : value.gt(0) ? "text-positive" : "text-negative";

/**
 * `Sessão de mercado` (iOS market session sheet): the indicator with its chart and ranges, or the session's
 * breadth when there is no indicator, then the session metrics. `1D` needs trades today; `Tudo` is Plus.
 */
export function MarketSessionSheet({ open, onClose, loaded }: { open: boolean; onClose: () => void; loaded: { snapshot: MarketSnapshot; at: number } }) {
  const t = useTranslations();
  const format = useFormat();
  const account = useAccount();
  const { snapshot, at } = loaded;
  const index = snapshot.index;
  const hasIndex = index.value !== undefined && index.tradingDate !== undefined;
  const [rangeName, setRangeName] = useState<RangeName>("oneMonth");
  const [selected, setSelected] = useState<number>();
  const range = RANGE_OF[rangeName];
  const points = useMemo(() => rangePoints(range, index.history), [range, index.history]);
  const statistics = hasUsableStatistics(snapshot, at);
  const visible = visibleOutsideSearch(snapshot.securities, at);
  const movers = marketMovers(visible, at, 0);
  const indexValue = (value: Decimal) => format.number(value, { digits: 2 });
  const selectedPoint = selected === undefined ? undefined : points[selected];

  const enabled = (name: RangeName) => {
    const candidate = RANGE_OF[name];
    if (candidate === "1D" && snapshot.trades === 0) return false;
    return isRangeAvailable(candidate, index.history);
  };
  const choose = (name: RangeName) => {
    if (name === "all" && account && !account.unlocksPlus) return account.requestUpgrade("history");
    setSelected(undefined);
    setRangeName(name);
  };

  return (
    <Dialog open={open} onClose={onClose} title={t("home.header.marketSession")}>
      <div className="flex flex-col gap-6 px-5 pt-2 pb-8" data-testid="market-session">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1">
              <h3 className="text-body font-semibold text-primary-text">{hasIndex ? t("common.appIndicator") : t("home.hero.title")}</h3>
              <IndexInfo />
            </span>
            <MarketStatusIndicator status={snapshot.status} />
          </div>
          {hasIndex ? (
            <>
              <p className="text-headline text-primary-text tabular-nums">{indexValue(selectedPoint?.value ?? index.value!)}</p>
              {selectedPoint ? (
                <p className="text-caption text-secondary-text">{format.date(selectedPoint.date)}</p>
              ) : index.percentageChange ? (
                <p className={cn("text-secondary font-semibold", tone(index.percentageChange))}>
                  {index.dailyChange ? `${format.number(index.dailyChange, { digits: 2, signed: true })} (${format.percent(index.percentageChange)})` : format.percent(index.percentageChange)}
                </p>
              ) : null}
            </>
          ) : (
            <>
              {statistics ? (
                <>
                  <p className="text-headline text-primary-text tabular-nums">{format.count(snapshot.sessionVolume)}</p>
                  <p className="text-caption text-secondary-text">{t("home.hero.tradedSecurities", { arg1: format.count(snapshot.trades) })}</p>
                </>
              ) : (
                <p className="text-section text-secondary-text">{t("home.hero.awaitingUpdate")}</p>
              )}
              <p className="mt-2 flex gap-4 text-secondary font-semibold">
                <span className="flex items-center gap-1 text-positive">
                  <Icon name="arrow-up" />
                  {t("home.hero.gains", { arg1: format.count(movers.gainCount) })}
                </span>
                <span className="flex items-center gap-1 text-negative">
                  <Icon name="arrow-down" />
                  {t("home.hero.declines", { arg1: format.count(movers.lossCount) })}
                </span>
              </p>
            </>
          )}
        </div>

        {hasIndex ? (
          <section aria-label={t("home.chart.indexSeries")} className="flex flex-col gap-3">
            {points.length >= 2 ? (
              <PriceChart
                points={points}
                bond={false}
                currency="AOA"
                lineWidth={TIME_RANGE_LINE_WIDTH[range]}
                selected={selected}
                onSelect={setSelected}
                formatValue={indexValue}
              />
            ) : (
              <p className="flex h-40 items-center justify-center text-center text-secondary text-secondary-text">{t("assetDetails.chart.notEnoughData")}</p>
            )}
            <TimeRangePicker label={t("home.chart.indexSeries")} ranges={RANGE_NAMES} value={rangeName} isEnabled={enabled} onChange={choose} />
          </section>
        ) : null}

        <dl className="grid grid-cols-1 gap-4 border-t border-separator pt-5 min-[24rem]:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className="text-caption text-secondary-text">{t("home.metrics.tradingVolume")}</dt>
            <dd className="text-body font-semibold text-primary-text">
              {statistics ? t("home.metrics.securitiesCount", { arg1: format.count(snapshot.sessionVolume) }) : "—"}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-caption text-secondary-text">{t("common.trades")}</dt>
            <dd className="text-body font-semibold text-primary-text">{statistics ? format.count(snapshot.trades) : "—"}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-caption text-secondary-text">{t("common.instruments")}</dt>
            <dd className="flex flex-col">
              <span className="text-body font-semibold text-primary-text">{format.count(visible.length)}</span>
              <span className="text-micro text-tertiary-text uppercase">{t("home.metrics.available")}</span>
            </dd>
          </div>
        </dl>
      </div>
    </Dialog>
  );
}
