"use client";

import Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { type PricePoint, TIME_RANGE_LINE_WIDTH, tradingDateNoon } from "@/domain/market";
import type { ValuePoint } from "@/domain/portfolio";
import { type BenchmarkQuote, type BenchmarkQuoteWire, fromQuoteWire } from "@/domain/portfolio/benchmark";
import { orderWhileHidden } from "@/domain/privacy/privacy";
import { CHART_HEIGHT, PriceChart } from "@/features/chart/price-chart";
import { RANGE_OF } from "@/features/chart/ranges";
import type { CatalogueRow } from "@/features/market/browse/price-cell";
import { PrivacyModeButton, usePrivacyMode } from "@/features/privacy/privacy-mode";
import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { Button, ButtonLink } from "@/ui/components/buttons";
import { SectionTabs, type TimeRange as RangeName, TimeRangePicker } from "@/ui/components/controls";
import { HiddenValue } from "@/ui/components/feedback";
import { SecurityLogo } from "@/ui/components/rows";
import { ErrorState, InstrumentRowSkeleton, Skeleton } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { BookMenu, useSelectionTitle } from "./book-menu";
import { CsvTransfer } from "./csv-transfer";
import { Private, toneOf, useQuantityText } from "./portfolio-ui";
import { type EditorRequest, TransactionEditor } from "./transaction-editor";
import { BenchmarkSection, CashSection, ResultsSection } from "./summary-sections";
import { type PortfolioModel, usePortfolio } from "./use-portfolio";

const RANGES: readonly RangeName[] = ["oneWeek", "oneMonth", "threeMonths", "sixMonths", "oneYear", "all"];
export const PORTFOLIO_PATH = "/carteira";

const chartPoints = (points: readonly ValuePoint[]): PricePoint[] => points.map((point) => ({ date: tradingDateNoon(point.day)!, value: point.value }));

/** `/carteira` (iOS `PortfolioView`): skeleton, error, empty state or the dashboard, valued at current quotes. */
export function PortfolioView({ rows, renderedAt, quotes: wires }: { rows: readonly CatalogueRow[]; renderedAt: number; quotes: readonly BenchmarkQuoteWire[] | null }) {
  const quotes = useMemo(() => wires?.map(fromQuoteWire) ?? null, [wires]);
  const t = useTranslations();
  const model = usePortfolio(rows, renderedAt);
  const title = useSelectionTitle(model);
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const loaded = model.status === "loaded";
  const open = model.valid ? model.positions : [];

  return (
    <div className="flex flex-col gap-8" data-testid="portfolio">
      <header className="flex flex-wrap items-center gap-3">
        {/* Phones: the actions on top, the title on its own line below (iOS large title). */}
        <h1 className="min-w-0 flex-1 basis-full truncate text-display text-primary-text sm:basis-0" data-testid="portfolio-title">
          {title}
        </h1>
        <div className="order-first ml-auto flex items-center gap-2 sm:order-none">
          <PrivacyModeButton />
          {loaded ? <BookMenu model={model} /> : null}
          {loaded ? <CsvTransfer model={model} /> : null}
          {loaded && model.transactions.length > 0 ? (
            <ButtonLink kind="secondary" icon="history" href={`${PORTFOLIO_PATH}/registos`} data-testid="records-link">
              {t("common.records")}
            </ButtonLink>
          ) : null}
        </div>
      </header>

      {!loaded && model.status !== "failed" ? (
        <DashboardSkeleton />
      ) : model.status === "failed" ? (
        <ErrorState message={t("errors.portfolio.loadFailed")} action={<Button onClick={() => void model.store.load()}>{t("common.tryAgain")}</Button>} />
      ) : !model.valid && model.transactions.length > 0 ? (
        <section className="flex flex-col gap-4" data-testid="portfolio-invalid">
          <p className="text-body text-primary-text">{t("portfolio.summary.valueUnavailable")}</p>
          <p className="text-secondary text-secondary-text">{t("portfolio.csvTransfer.invalidPortfolio")}</p>
        </section>
      ) : open.length === 0 ? (
        <EmptyPortfolio onRecord={() => setEditor({ mode: "new" })} />
      ) : (
        <Dashboard model={model} quotes={quotes} onRecord={() => setEditor({ mode: "new" })} />
      )}

      <TransactionEditor request={editor} model={model} onClose={() => setEditor(null)} />
    </div>
  );
}

function DashboardSkeleton() {
  const t = useTranslations();
  return (
    <div role="status" aria-label={t("portfolio.header.loading")} className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-45 w-full" />
        <Skeleton className="h-13 w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-11 w-full" />
        {[0, 1, 2, 3].map((index) => (
          <InstrumentRowSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

function EmptyPortfolio({ onRecord }: { onRecord: () => void }) {
  const t = useTranslations();
  return (
    <section className="mx-auto flex max-w-[480px] flex-col items-center gap-4 py-8 text-center" data-testid="portfolio-empty">
      <span className="flex size-18 items-center justify-center rounded-full bg-accent/12 text-accent">
        <Icon name="portfolio" className="size-8" />
      </span>
      <h2 className="text-section text-primary-text">{t("portfolio.emptyState.title")}</h2>
      <p className="text-body text-secondary-text">{t("portfolio.emptyState.message")}</p>
      <Button icon="add" className="w-full" onClick={onRecord} data-testid="record-purchase">
        {t("common.recordPurchase")}
      </Button>
      <ButtonLink kind="secondary" icon="calculator" className="w-full" href="/simulador">
        {t("common.simulateInvestment")}
      </ButtonLink>
      <p className="text-caption text-secondary-text">{t("portfolio.emptyState.manualEntryNotice")}</p>
    </section>
  );
}

const TABS = ["portfolio.dashboard.positionsTab", "common.allocation", "portfolio.dashboard.summaryTab"] as const;

function Dashboard({ model, quotes, onRecord }: { model: PortfolioModel; quotes: readonly BenchmarkQuote[] | null; onRecord: () => void }) {
  const t = useTranslations();
  const [range, setRange] = useState<RangeName>("oneMonth");
  const [tab, setTab] = useState(0);
  const domainRange = RANGE_OF[range];
  const { series } = model;
  const { points, change } = useMemo(() => series(domainRange), [series, domainRange]);

  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
      <div className="flex flex-col gap-6">
        <Summary model={model} change={change} hasHistory={points.length >= 2} />
        <section aria-label={t("portfolio.performance.title")} className="flex flex-col gap-4">
          <ValueChart points={points} range={domainRange} pending={model.historyPending} />
          <TimeRangePicker value={range} onChange={setRange} ranges={RANGES} label={t("portfolio.performance.title")} />
        </section>
        <Button icon="add" className="w-full" onClick={onRecord} data-testid="record-purchase">
          {t("common.recordPurchase")}
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        <SectionTabs label={t("common.portfolio")} titles={TABS.map((key) => t(key))} selected={tab} onSelect={setTab} idPrefix="portfolio" />
        <div role="tabpanel" id={`portfolio-panel-${tab}`} aria-labelledby={`portfolio-tab-${tab}`}>
          {tab === 0 ? <Holdings model={model} /> : tab === 1 ? <Allocation model={model} /> : <SummaryTab model={model} points={points} quotes={quotes} />}
        </div>
        {model.valueState === "partial" ? <p className="text-secondary text-warning">{t("portfolio.dashboard.partialValuesNotice")}</p> : null}
      </div>
    </div>
  );
}

const SUMMARY_TITLES = {
  pending: "common.portfolioValue",
  full: "common.portfolioValue",
  partial: "portfolio.summary.partialValue",
  unavailable: "portfolio.summary.valueUnavailable",
} as const;

function Summary({ model, change, hasHistory }: { model: PortfolioModel; change: ReturnType<PortfolioModel["series"]>["change"]; hasHistory: boolean }) {
  const t = useTranslations();
  const format = useFormat();
  const { summary, valueState } = model;
  return (
    <section className="flex flex-col items-start gap-2" data-testid="portfolio-summary" data-value-state={valueState}>
      <span className="rounded-full bg-accent/12 px-3 py-1 text-caption font-semibold text-accent">{t("portfolio.summary.manualRecords")}</span>
      <h2 className="text-secondary text-secondary-text">{t(SUMMARY_TITLES[valueState])}</h2>
      {valueState === "pending" ? (
        <Skeleton className="h-12 w-56" />
      ) : valueState === "unavailable" ? (
        <>
          <p className="text-headline text-primary-text">—</p>
          <p className="text-secondary text-secondary-text">{t("portfolio.summary.noQuotes")}</p>
        </>
      ) : (
        <>
          <Private className="text-[clamp(1.75rem,8vw,2.75rem)] font-semibold text-primary-text">
            <span data-testid="portfolio-value">{format.currency(summary.currentValue, { digits: 2 })}</span>
          </Private>
          {change ? (
            <Private className={cn("flex items-center gap-1 text-body font-semibold tabular-nums", toneOf(change.amount))}>
              <span data-testid="portfolio-change">
                {format.currency(change.amount, { signed: true })}
                {change.percentage ? ` (${format.percent(change.percentage)})` : ""}
              </span>
            </Private>
          ) : !hasHistory ? (
            <p className="text-secondary text-secondary-text">{t("portfolio.summary.insufficientHistory")}</p>
          ) : null}
          {summary.missingPriceCount > 0 ? (
            <p className="flex items-center gap-1 text-secondary text-warning">
              <Icon name="warning" />
              {summary.missingPriceCount === 1 ? t("portfolio.summary.missingQuoteOne") : t("portfolio.summary.missingQuotesCount", { arg1: format.count(summary.missingPriceCount) })}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function ValueChart({ points, range, pending }: { points: readonly ValuePoint[]; range: keyof typeof TIME_RANGE_LINE_WIDTH; pending: boolean }) {
  const t = useTranslations();
  const format = useFormat();
  const hidden = usePrivacyMode();
  const [selected, setSelected] = useState<number>();
  const data = useMemo(() => chartPoints(points), [points]);
  if (pending && data.length < 2) return <Skeleton className="h-45 w-full" />;
  if (data.length < 2) {
    return (
      <div className="flex min-h-45 flex-col items-center justify-center gap-2 rounded-large bg-elevated-background p-6 text-center">
        <Icon name="chart" className="text-secondary-text" />
        <p className="text-secondary text-secondary-text">{t("portfolio.performance.chartUnavailable")}</p>
      </div>
    );
  }
  if (hidden) return <PrivateTrend points={data} />;
  return (
    <div data-testid="portfolio-chart">
      <PriceChart
        points={data}
        bond={false}
        currency="AOA"
        formatValue={(value) => format.currency(value)}
        lineWidth={TIME_RANGE_LINE_WIDTH[range]}
        selected={selected}
        onSelect={setSelected}
      />
    </div>
  );
}

/** Privacy mode: the line's shape only, scaled 0–1 with no value axis, so no amount can be read off it. */
function PrivateTrend({ points }: { points: readonly PricePoint[] }) {
  const t = useTranslations();
  const format = useFormat();
  const path = useMemo(() => {
    const values = points.map((point) => point.value);
    const low = Decimal.min(...values);
    const span = Decimal.max(...values).minus(low);
    const first = new Decimal(points[0].date);
    const width = Decimal.max(new Decimal(points.at(-1)!.date).minus(first), 1);
    const plot = new Decimal(CHART_HEIGHT).minus(8);
    return points
      .map((point, index) => {
        const share = span.isZero() ? new Decimal("0.5") : point.value.minus(low).div(span);
        const x = new Decimal(point.date).minus(first).div(width).times(100);
        const y = new Decimal(1).minus(share).times(plot).plus(4);
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [points]);
  return (
    <figure className="flex flex-col gap-2" data-testid="portfolio-private-trend">
      <svg role="img" aria-label={t("portfolio.privateTrend.valuesHiddenLabel")} viewBox={`0 0 100 ${CHART_HEIGHT}`} preserveAspectRatio="none" className="h-55 w-full">
        <path d={path} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" className="stroke-accent" />
      </svg>
      <figcaption className="flex justify-between text-caption text-secondary-text">
        <span>{format.date(points[0].date)}</span>
        <span>{format.date(points.at(-1)!.date)}</span>
      </figcaption>
    </figure>
  );
}

function Holdings({ model }: { model: PortfolioModel }) {
  const t = useTranslations();
  const format = useFormat();
  const hidden = usePrivacyMode();
  const quantityText = useQuantityText();
  const rows = useMemo(() => {
    const byValue = [...model.valuations].sort((a, b) => (b.currentValue ?? new Decimal(-1)).comparedTo(a.currentValue ?? new Decimal(-1)));
    return orderWhileHidden(
      byValue.map((valuation) => ({ id: valuation.position.securityId, valuation })),
      hidden,
    );
  }, [model.valuations, hidden]);
  return (
    <ul className="flex flex-col" data-testid="holdings">
      {rows.map(({ id, valuation }) => {
        const instrument = model.instruments.get(id);
        return (
          <li key={id} className="border-b border-separator last:border-b-0">
            <Link
              href={`${PORTFOLIO_PATH}/${id}`}
              className="flex min-h-19 items-center gap-3 py-3"
              aria-description={t("portfolio.accessibility.positionDetailsHint")}
              data-testid="holding-row"
            >
              <SecurityLogo symbol={instrument?.symbol ?? "—"} logoUrl={instrument?.logoURL} brandColor={instrument?.bond ? "violet" : "blue"} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-body font-semibold text-primary-text" data-testid="holding-symbol">
                  {instrument?.symbol ?? t("common.instrumentUnavailable")}
                </span>
                <span className="truncate text-caption text-secondary-text">{instrument?.name ?? ""}</span>
                <Private className="text-caption text-secondary-text">{quantityText(valuation.position.quantity, instrument)}</Private>
              </span>
              <span className="flex flex-col items-end gap-1 text-right">
                {valuation.currentValue ? (
                  <>
                    <Private className="text-body font-semibold text-primary-text">{format.currency(valuation.currentValue)}</Private>
                    {valuation.returnPercentage ? (
                      <Private className={cn("text-secondary tabular-nums", toneOf(valuation.returnPercentage))}>{format.percent(valuation.returnPercentage)}</Private>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span className="text-secondary text-tertiary-text">{t("common.quoteUnavailable")}</span>
                    <span className="flex items-center gap-1 text-secondary text-warning">
                      <Icon name="warning" />—
                    </span>
                  </>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Allocation({ model }: { model: PortfolioModel }) {
  const t = useTranslations();
  const format = useFormat();
  const hidden = usePrivacyMode();
  if (model.summary.missingPriceCount > 0 || model.allocations.length === 0) {
    return <p className="py-4 text-body text-secondary-text">{t("portfolio.dashboard.allocationUnavailable")}</p>;
  }
  if (hidden) return <HiddenValue className="block py-4" />;
  const top = model.allocations.slice(0, 5);
  const rest = model.allocations.slice(5);
  const rows = [
    ...top.map((item) => ({ key: item.securityId, title: model.instruments.get(item.securityId)?.symbol ?? "—", subtitle: model.instruments.get(item.securityId)?.name ?? "", ...item })),
    ...(rest.length
      ? [
          {
            key: "other",
            title: t("common.other"),
            subtitle: rest.length === 1 ? t("portfolio.allocation.oneInstrument") : t("common.instrumentsCount", { arg1: format.count(rest.length) }),
            percentage: rest.reduce((total, item) => total.plus(item.percentage), new Decimal(0)),
            currentValue: rest.reduce((total, item) => total.plus(item.currentValue), new Decimal(0)),
          },
        ]
      : []),
  ];
  return (
    <ul className="flex flex-col gap-4 py-2" data-testid="allocation">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-2">
          <div className="flex items-baseline gap-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body font-semibold text-primary-text">{row.title}</span>
              <span className="truncate text-caption text-secondary-text">{row.subtitle}</span>
            </span>
            <span className="flex flex-col items-end">
              <span className="text-body font-semibold text-primary-text">{format.number(row.percentage, { digits: 1 })}%</span>
              <span className="text-caption text-secondary-text">{format.currency(row.currentValue)}</span>
            </span>
          </div>
          <progress max={100} value={row.percentage.toNumber()} aria-label={t("portfolio.allocationRow.portfolioWeight")} className="h-1.5 w-full accent-accent" />
        </li>
      ))}
    </ul>
  );
}

function SummaryTab({ model, points, quotes }: { model: PortfolioModel; points: readonly ValuePoint[]; quotes: readonly BenchmarkQuote[] | null }) {
  const t = useTranslations();
  const format = useFormat();
  const { summary, valueState } = model;
  const partial = valueState === "partial";
  const none = valueState === "unavailable" || valueState === "pending";
  const tiles = [
    { title: t("common.investedAmount"), value: format.currency(summary.investedAmount), tone: "text-primary-text" },
    { title: t(partial ? "common.partialValue" : none ? "common.valueUnavailable" : "common.currentValue"), value: none ? "—" : format.currency(summary.currentValue), tone: "text-primary-text" },
    {
      title: t(partial ? "portfolio.metrics.partialGainLoss" : "portfolio.metrics.unrealizedGainLoss"),
      value: none ? "—" : format.currency(summary.unrealizedProfitLoss, { signed: true }),
      tone: none ? "text-secondary-text" : toneOf(summary.unrealizedProfitLoss),
    },
    {
      title: t(partial ? "portfolio.metrics.partialChangeVsCost" : "portfolio.metrics.changeVsCost"),
      value: none ? "—" : format.percent(summary.returnPercentage),
      tone: none ? "text-secondary-text" : toneOf(summary.returnPercentage),
    },
  ];
  return (
    <div className="flex flex-col gap-6 py-2">
      <ButtonLink kind="secondary" icon="calendar" href={`${PORTFOLIO_PATH}/rendimentos`} data-testid="income-link">
        {t("income.title")}
      </ButtonLink>
      <dl className="grid grid-cols-2 gap-3" data-testid="portfolio-metrics">
        {tiles.map((tile) => (
          <div key={tile.title} className="flex flex-col gap-1 rounded-medium bg-elevated-background p-4">
            <dt className="text-caption text-secondary-text">{tile.title}</dt>
            <dd className={cn("text-body font-semibold tabular-nums", tile.tone)}>
              <Private>{tile.value}</Private>
            </dd>
          </div>
        ))}
      </dl>
      <CashSection model={model} />
      <BenchmarkSection model={model} points={points} quotes={quotes} />
      <ResultsSection model={model} />
      <ButtonLink kind="secondary" icon="calculator" href="/simulador">
        {t("common.simulateInvestment")}
      </ButtonLink>
    </div>
  );
}
