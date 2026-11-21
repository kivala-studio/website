"use client";

import Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { type PricePoint, TIME_RANGE_LINE_WIDTH, nameBeyondSymbol, tradingDateNoon } from "@/domain/market";
import type { ValuePoint } from "@/domain/portfolio";
import { type BenchmarkQuote, type BenchmarkQuoteWire, fromQuoteWire } from "@/domain/portfolio/benchmark";
import { orderWhileHidden } from "@/domain/privacy/privacy";
import { CHART_HEIGHT, PriceChart } from "@/features/chart/price-chart";
import { RANGE_OF } from "@/features/chart/ranges";
import { PortfolioInsights } from "@/features/intelligence/portfolio-insights";
import type { CatalogueRow } from "@/features/market/browse/price-cell";
import { PrivacyModeButton, usePrivacyMode } from "@/features/privacy/privacy-mode";
import { cn } from "@/ui/cn";
import { Button, ButtonLink } from "@/ui/components/buttons";
import { type TimeRange as RangeName, TimeRangePicker } from "@/ui/components/controls";
import { HiddenValue } from "@/ui/components/feedback";
import { Card } from "@/ui/components/layout";
import { SecurityLogo } from "@/ui/components/rows";
import { DataTable, TableCell, TableHead, TableHeaderCell, TableNameCell, TableRow } from "@/ui/components/table";
import { ErrorState, InstrumentRowSkeleton, Skeleton } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";
import { AnimatedText } from "@/ui/components/animated-value";
import { FlipList } from "@/ui/components/flip-list";
import { Meter } from "@/ui/components/meter";
import { useEntrance } from "@/ui/motion/use-entrance";

import { BookMenu, ShareButton, useSelectionTitle } from "./book-menu";
import { CsvTransfer } from "./csv-transfer";
import { Private, toneOf, useQuantityText } from "./portfolio-ui";
import { type EditorRequest, TransactionEditor } from "./transaction-editor";
import { BenchmarkSection, CashSection, Metric, ResultsSection } from "./summary-sections";
import { type PortfolioModel, usePortfolio } from "./use-portfolio";

const RANGES: readonly RangeName[] = ["oneWeek", "oneMonth", "threeMonths", "sixMonths", "oneYear", "all"];
export const PORTFOLIO_PATH = "/carteira";

const chartPoints = (points: readonly ValuePoint[]): PricePoint[] => points.map((point) => ({ date: tradingDateNoon(point.day)!, value: point.value }));

/** `/carteira` (iOS `PortfolioView`): skeleton, error, empty state or the dashboard, valued at current quotes. */
export function PortfolioView({
  rows,
  renderedAt,
  quotes: wires,
}: {
  rows: readonly CatalogueRow[];
  renderedAt: number;
  quotes: readonly BenchmarkQuoteWire[] | null;
}) {
  const quotes = useMemo(() => wires?.map(fromQuoteWire) ?? null, [wires]);
  const t = useTranslations();
  const model = usePortfolio(rows, renderedAt);
  const title = useSelectionTitle(model);
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const loaded = model.status === "loaded";
  const open = model.valid ? model.positions : [];
  const dashboard = loaded && open.length > 0;
  const record = () => setEditor({ mode: "new" });

  return (
    <div className="flex flex-col gap-6" data-testid="portfolio">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="min-w-0 flex-1 truncate text-display text-primary-text" data-testid="portfolio-title">
          {title}
        </h1>
        <PrivacyModeButton />
        {loaded ? (
          <div className="flex flex-wrap items-center gap-2 max-sm:basis-full">
            <BookMenu model={model} />
            <ShareButton model={model} />
          </div>
        ) : null}
      </header>

      {loaded ? (
        // Phones: one scrolling strip of pills (CoinStats); wider screens wrap them.
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
          data-testid="portfolio-actions"
        >
          {dashboard ? (
            <Button size="compact" icon="add" onClick={record} data-testid="record-purchase">
              {t("common.recordPurchase")}
            </Button>
          ) : null}
          <CsvTransfer model={model} />
          {dashboard ? (
            <ButtonLink kind="secondary" size="compact" icon="calculator" href="/simulador">
              {t("common.simulateInvestment")}
            </ButtonLink>
          ) : null}
        </div>
      ) : null}

      {!loaded && model.status !== "failed" ? (
        <DashboardSkeleton />
      ) : model.status === "failed" ? (
        <ErrorState message={t("errors.portfolio.loadFailed")} action={<Button onClick={() => void model.store.load()}>{t("common.tryAgain")}</Button>} />
      ) : !model.valid && model.transactions.length > 0 ? (
        <Card className="flex flex-col gap-2" data-testid="portfolio-invalid">
          <p className="text-body text-primary-text">{t("portfolio.summary.valueUnavailable")}</p>
          <p className="text-secondary text-secondary-text">{t("portfolio.csvTransfer.invalidPortfolio")}</p>
        </Card>
      ) : open.length === 0 ? (
        <EmptyPortfolio onRecord={record} />
      ) : (
        <Dashboard model={model} quotes={quotes} />
      )}

      <TransactionEditor request={editor} model={model} onClose={() => setEditor(null)} />
    </div>
  );
}

/** The value card and the positions while the ledger loads; also the portfolio routes' `loading.tsx`. */
export function DashboardSkeleton() {
  const t = useTranslations();
  return (
    <div role="status" aria-label={t("portfolio.header.loading")} className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-45 w-full" />
      </Card>
      <Card className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        {[0, 1, 2, 3].map((index) => (
          <InstrumentRowSkeleton key={index} />
        ))}
      </Card>
    </div>
  );
}

function EmptyPortfolio({ onRecord }: { onRecord: () => void }) {
  const t = useTranslations();
  const entrance = useEntrance();
  return (
    <Card className={entrance ? "motion-fade-in" : undefined}>
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
    </Card>
  );
}

/**
 * The dashboard (CoinStats portfolio dashboard): the value card with its chart, the positions table, then iOS's
 * other tabs and sections as cards, two columns from 1280 px.
 */
function Dashboard({ model, quotes }: { model: PortfolioModel; quotes: readonly BenchmarkQuote[] | null }) {
  const entrance = useEntrance();
  const [range, setRange] = useState<RangeName>("oneMonth");
  const domainRange = RANGE_OF[range];
  const { series } = model;
  const { points, change } = useMemo(() => series(domainRange), [series, domainRange]);

  return (
    <div className={cn("flex flex-col gap-6", entrance && "motion-fade-in")}>
      <Summary model={model} change={change} points={points} range={range} onRange={setRange} />
      <Holdings model={model} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <SummaryCard model={model} />
        <Allocation model={model} />
        <CashSection model={model} />
        <BenchmarkSection model={model} points={points} quotes={quotes} />
        <ResultsSection model={model} />
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

/** The value card: the figure and its change for the chart's range (CoinStats "Total Worth"), the range, the chart. */
function Summary({
  model,
  change,
  points,
  range,
  onRange,
}: {
  model: PortfolioModel;
  change: ReturnType<PortfolioModel["series"]>["change"];
  points: readonly ValuePoint[];
  range: RangeName;
  onRange: (range: RangeName) => void;
}) {
  const t = useTranslations();
  const format = useFormat();
  const { summary, valueState } = model;
  return (
    <Card
      role="region"
      aria-labelledby="portfolio-summary-title"
      className="flex flex-col gap-5"
      data-testid="portfolio-summary"
      data-value-state={valueState}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col items-start gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="portfolio-summary-title" className="text-secondary text-secondary-text">
              {t(SUMMARY_TITLES[valueState])}
            </h2>
            <span className="rounded-full bg-accent/12 px-3 py-1 text-caption font-semibold text-accent">{t("portfolio.summary.manualRecords")}</span>
          </div>
          {valueState === "pending" ? (
            <Skeleton className="h-12 w-56" />
          ) : valueState === "unavailable" ? (
            <>
              <p className="font-display text-headline text-primary-text">—</p>
              <p className="text-secondary text-secondary-text">{t("portfolio.summary.noQuotes")}</p>
            </>
          ) : (
            <>
              <Private className="font-display text-[clamp(1.75rem,8vw,2.75rem)] leading-tight font-semibold tracking-tight text-primary-text">
                <span data-testid="portfolio-value">
                  <AnimatedText text={format.currency(summary.currentValue, { digits: 2 })} numeric={summary.currentValue.toString()} className="inline-block" />
                </span>
              </Private>
              {change ? (
                <Private className={cn("flex items-center gap-1 font-display text-body font-semibold tabular-nums transition-colors", toneOf(change.amount))}>
                  <span data-testid="portfolio-change">
                    <AnimatedText
                      text={`${format.currency(change.amount, { signed: true })}${change.percentage ? ` (${format.percent(change.percentage)})` : ""}`}
                      numeric={change.amount.toString()}
                      className="inline-block"
                    />
                  </span>
                </Private>
              ) : points.length < 2 ? (
                <p className="text-secondary text-secondary-text">{t("portfolio.summary.insufficientHistory")}</p>
              ) : null}
              {summary.missingPriceCount > 0 ? (
                <p className="flex items-center gap-1 text-secondary text-warning">
                  <Icon name="warning" />
                  {summary.missingPriceCount === 1
                    ? t("portfolio.summary.missingQuoteOne")
                    : t("portfolio.summary.missingQuotesCount", { arg1: format.count(summary.missingPriceCount) })}
                </p>
              ) : null}
            </>
          )}
        </div>
        <TimeRangePicker value={range} onChange={onRange} ranges={RANGES} label={t("portfolio.performance.title")} variant="segmented" />
      </div>
      <ValueChart points={points} range={RANGE_OF[range]} pending={model.historyPending} />
    </Card>
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
      <svg
        role="img"
        aria-label={t("portfolio.privateTrend.valuesHiddenLabel")}
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-55 w-full"
      >
        <path d={path} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" className="stroke-accent" />
      </svg>
      <figcaption className="flex justify-between text-caption text-secondary-text">
        <span>{format.date(points[0].date)}</span>
        <span>{format.date(points.at(-1)!.date)}</span>
      </figcaption>
    </figure>
  );
}

/** Posições as a table (CoinStats "Assets"): the whole row opens the position; personal figures masked in privacy mode. */
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
    <Card title={t("portfolio.dashboard.positionsTab")} titleId="portfolio-positions" flush>
      <div className="px-5 pb-3 empty:hidden desk:px-6">
        <PortfolioInsights transactions={model.transactions} section={0} />
      </div>
      <DataTable data-testid="holdings">
        <TableHead>
          <TableHeaderCell>{t("common.instrument")}</TableHeaderCell>
          <TableHeaderCell align="right" className="max-md:hidden">
            {t("common.quantity")}
          </TableHeaderCell>
          <TableHeaderCell align="right" className="max-lg:hidden">
            {t("portfolio.positionContent.currentPrice")}
          </TableHeaderCell>
          <TableHeaderCell align="right" className="max-xl:hidden">
            {t("portfolio.positionContent.averagePurchasePrice")}
          </TableHeaderCell>
          <TableHeaderCell align="right">{t("common.value")}</TableHeaderCell>
          <TableHeaderCell align="right" className="max-sm:hidden">
            {t("portfolio.positionContent.gainLoss")}
          </TableHeaderCell>
        </TableHead>
        <FlipList as="tbody">
          {rows.map(({ id, valuation }) => {
            const instrument = model.instruments.get(id);
            const bond = instrument?.bond ?? false;
            const { position } = valuation;
            const quantity = quantityText(position.quantity, instrument);
            const name = instrument ? nameBeyondSymbol(instrument.name, instrument.symbol) : undefined;
            return (
              <TableRow key={id} data-flip-key={id} data-testid="holding-row">
                <TableNameCell
                  href={`${PORTFOLIO_PATH}/${id}`}
                  linkProps={{ "aria-description": t("portfolio.accessibility.positionDetailsHint") }}
                  logo={<SecurityLogo symbol={instrument?.symbol ?? "—"} logoUrl={instrument?.logoURL} brandColor={bond ? "violet" : "blue"} size="s" />}
                  name={<span data-testid="holding-symbol">{instrument?.symbol ?? t("common.instrumentUnavailable")}</span>}
                  detail={
                    <>
                      {name ? <span className="truncate">{name}</span> : null}
                      <Private className="md:hidden">{quantity}</Private>
                    </>
                  }
                />
                <TableCell numeric className="max-md:hidden">
                  <Private>{quantity}</Private>
                </TableCell>
                <TableCell numeric className="max-lg:hidden" data-testid="holding-price">
                  {valuation.currentPrice ? (
                    <AnimatedText text={format.securityPrice(valuation.currentPrice, { bond })} numeric={valuation.currentPrice.toString()} live className="inline-block" />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell numeric className="max-xl:hidden">
                  <Private>{format.securityPrice(position.averagePurchasePrice, { bond })}</Private>
                </TableCell>
                <TableCell numeric>
                  {valuation.currentValue ? (
                    <span className="flex flex-col items-end gap-0.5">
                      <Private className="font-semibold">
                        <AnimatedText text={format.currency(valuation.currentValue)} numeric={valuation.currentValue.toString()} className="inline-block" />
                      </Private>
                      {valuation.returnPercentage ? (
                        <Private className={cn("text-secondary tabular-nums sm:hidden", toneOf(valuation.returnPercentage))}>
                          {format.percent(valuation.returnPercentage)}
                        </Private>
                      ) : null}
                    </span>
                  ) : (
                    <span className="flex flex-col items-end gap-0.5">
                      <span className="font-sans text-secondary text-tertiary-text">{t("common.quoteUnavailable")}</span>
                      <span className="flex items-center gap-1 text-secondary text-warning">
                        <Icon name="warning" />—
                      </span>
                    </span>
                  )}
                </TableCell>
                <TableCell numeric className="max-sm:hidden">
                  {valuation.unrealizedProfitLoss ? (
                    <span className={cn("flex flex-col items-end gap-0.5 tabular-nums", toneOf(valuation.unrealizedProfitLoss))}>
                      <Private>{format.currency(valuation.unrealizedProfitLoss, { signed: true })}</Private>
                      {valuation.returnPercentage ? (
                        <Private className={cn("text-secondary", toneOf(valuation.returnPercentage))}>{format.percent(valuation.returnPercentage)}</Private>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-tertiary-text">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </FlipList>
      </DataTable>
      {model.valueState === "partial" ? <p className="px-5 pt-3 pb-5 text-secondary text-warning desk:px-6">{t("portfolio.dashboard.partialValuesNotice")}</p> : null}
    </Card>
  );
}

/** Distribuição: the five largest weights and the rest as `Outros`. */
function Allocation({ model }: { model: PortfolioModel }) {
  const t = useTranslations();
  return (
    <Card title={t("common.allocation")} titleId="portfolio-allocation" bodyClassName="flex flex-col gap-4">
      <PortfolioInsights transactions={model.transactions} section={1} />
      <AllocationList model={model} />
    </Card>
  );
}

function AllocationList({ model }: { model: PortfolioModel }) {
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
    ...top.map((item) => {
      const instrument = model.instruments.get(item.securityId);
      return { key: item.securityId, title: instrument?.symbol ?? "—", subtitle: instrument ? nameBeyondSymbol(instrument.name, instrument.symbol) : undefined, ...item };
    }),
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
    <FlipList className="flex flex-col gap-4" data-testid="allocation">
      {rows.map((row) => (
        <li key={row.key} data-flip-key={row.key} className="flex flex-col gap-2">
          <div className="flex items-baseline gap-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-display text-body font-semibold text-primary-text">{row.title}</span>
              {row.subtitle ? <span className="truncate text-caption text-secondary-text">{row.subtitle}</span> : null}
            </span>
            <span className="flex flex-col items-end">
              <AnimatedText text={`${format.number(row.percentage, { digits: 1 })}%`} numeric={row.percentage.toString()} className="inline-block font-display text-body font-semibold text-primary-text" />
              <AnimatedText text={format.currency(row.currentValue)} numeric={row.currentValue.toString()} className="inline-block text-caption text-secondary-text" />
            </span>
          </div>
          <Meter value={row.percentage.toNumber()} label={t("portfolio.allocationRow.portfolioWeight")} />
        </li>
      ))}
    </FlipList>
  );
}

/** Resumo: invested, current value, the unrealised result and the change against cost. */
function SummaryCard({ model }: { model: PortfolioModel }) {
  const t = useTranslations();
  const format = useFormat();
  const { summary, valueState } = model;
  const partial = valueState === "partial";
  const none = valueState === "unavailable" || valueState === "pending";
  return (
    <Card title={t("portfolio.dashboard.summaryTab")} titleId="portfolio-overview" bodyClassName="flex flex-col gap-4">
      <PortfolioInsights transactions={model.transactions} section={2} />
      <dl className="grid grid-cols-2 gap-3" data-testid="portfolio-metrics">
        <Metric title={t("common.investedAmount")} value={format.currency(summary.investedAmount)} />
        <Metric
          title={t(partial ? "common.partialValue" : none ? "common.valueUnavailable" : "common.currentValue")}
          value={none ? "—" : format.currency(summary.currentValue)}
        />
        <Metric
          title={t(partial ? "portfolio.metrics.partialGainLoss" : "portfolio.metrics.unrealizedGainLoss")}
          value={none ? "—" : format.currency(summary.unrealizedProfitLoss, { signed: true })}
          tone={none ? "text-secondary-text" : toneOf(summary.unrealizedProfitLoss)}
        />
        <Metric
          title={t(partial ? "portfolio.metrics.partialChangeVsCost" : "portfolio.metrics.changeVsCost")}
          value={none ? "—" : format.percent(summary.returnPercentage)}
          tone={none ? "text-secondary-text" : toneOf(summary.returnPercentage)}
        />
      </dl>
    </Card>
  );
}
