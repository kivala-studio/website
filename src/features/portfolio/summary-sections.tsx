"use client";

import Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { parseAmount } from "@/domain/format/amount-input";
import { luandaCivilDate } from "@/domain/format/date";
import { ledgerYearReport } from "@/domain/portfolio";
import { type BenchmarkQuote, type BenchmarkRate, benchmarkSeries } from "@/domain/portfolio/benchmark";
import { CASH_KINDS, type CashKind, type CashMovement, cashIssues, signedCashAmount } from "@/domain/portfolio/cash";
import type { ValuePoint } from "@/domain/portfolio";
import { reportFileName, yearReportPdf } from "@/domain/portfolio/year-report";
import { useAccount } from "@/features/account/account-provider";
import { usePrivacyMode } from "@/features/privacy/privacy-mode";
import { cn } from "@/ui/cn";
import { AmountField } from "@/ui/components/amount-field";
import { Button } from "@/ui/components/buttons";
import { SegmentedControl } from "@/ui/components/controls";
import { Dialog } from "@/ui/components/dialog";
import { HiddenValue } from "@/ui/components/feedback";
import { useFormat } from "@/ui/format";

import { useSelectionTitle } from "./book-menu";
import { Private, toneOf } from "./portfolio-ui";
import type { PortfolioModel } from "./use-portfolio";

const CASH_TITLES: Record<CashKind, string> = { deposit: "cash.kind.deposit", withdrawal: "cash.kind.withdrawal", fee: "cash.kind.fee" };

function Metric({ title, value, tone = "text-primary-text", testID }: { title: string; value: string; tone?: string; testID?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-medium bg-elevated-background p-4">
      <dt className="text-caption text-secondary-text">{title}</dt>
      <dd className={cn("text-body font-semibold tabular-nums", tone)} data-testid={testID}>
        <Private>{value}</Private>
      </dd>
    </div>
  );
}

// MARK: Cash

/** `Dinheiro` (iOS `PortfolioCashSection`, Plus to add): balance, net deposited, total value and result. */
export function CashSection({ model }: { model: PortfolioModel }) {
  const t = useTranslations();
  const format = useFormat();
  const account = useAccount();
  const [editing, setEditing] = useState(false);
  const [listing, setListing] = useState(false);
  const { cash, cashSummary, summary, valueState } = model;
  const noQuotes = valueState === "unavailable" || valueState === "pending";
  const total = summary.currentValue.plus(cashSummary.balance);
  const add = () => {
    if (account && !account.unlocksPlus) return account.requestUpgrade("cash");
    setListing(false);
    setEditing(true);
  };
  return (
    <section className="flex flex-col gap-3" aria-labelledby="cash-title" data-testid="cash-section">
      <div className="flex items-center gap-3">
        <h3 id="cash-title" className="flex-1 text-section text-primary-text">
          {t("cash.title")}
        </h3>
        {cash.length > 0 ? (
          <Button kind="secondary" className="w-auto! shrink-0" onClick={() => setListing(true)} data-testid="cash-movements">
            {t("cash.movements")}
          </Button>
        ) : null}
      </div>
      {cash.length === 0 ? (
        <Button kind="secondary" icon="add" onClick={add} data-testid="cash-add">
          {t("cash.add")}
        </Button>
      ) : (
        <dl className="grid grid-cols-2 gap-3" data-testid="cash-metrics">
          <Metric title={t("cash.balance")} value={format.currency(cashSummary.balance)} tone={cashSummary.balance.isNegative() ? "text-warning" : undefined} testID="cash-balance" />
          <Metric title={t("cash.deposited")} value={format.currency(cashSummary.netDeposited)} />
          <Metric title={t("cash.total")} value={noQuotes ? "—" : format.currency(total)} />
          <Metric
            title={t("cash.result")}
            value={noQuotes ? "—" : format.currency(total.minus(cashSummary.netDeposited), { signed: true })}
            tone={noQuotes ? "text-secondary-text" : toneOf(total.minus(cashSummary.netDeposited))}
            testID="cash-result"
          />
        </dl>
      )}
      {editing ? <CashEditor model={model} onClose={() => setEditing(false)} /> : null}
      {listing ? <MovementsDialog model={model} onAdd={add} onClose={() => setListing(false)} /> : null}
    </section>
  );
}

/** `Registar dinheiro`: deposit, withdrawal or fee; one id per editor, so a repeated save stores one movement. */
function CashEditor({ model, onClose }: { model: PortfolioModel; onClose: () => void }) {
  const t = useTranslations();
  const ids = { amount: useId(), date: useId() };
  const [id] = useState(() => crypto.randomUUID());
  const [portfolioId] = useState(() => model.writableBookId);
  const today = luandaCivilDate(model.asOf);
  const [kind, setKind] = useState<CashKind>("deposit");
  const [amountText, setAmountText] = useState("");
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const amount = amountText.trim() === "" ? null : parseAmount(amountText);
  const movement: CashMovement | null = amount ? { id, kind, amount, occurredOn: date, portfolioId } : null;
  const issues = movement ? cashIssues(movement, model.asOf) : ["amount"];
  const save = async () => {
    if (!movement || issues.length > 0) return;
    setSaving(true);
    const result = await model.store.createCash(movement);
    setSaving(false);
    // A plan rule closes the editor behind the plan dialog, as on iOS.
    if (result === "saved" || result === "upgrade") onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("cash.add")}
      footer={
        <Button icon="check" disabled={issues.length > 0} loading={saving} onClick={() => void save()} data-testid="cash-save">
          {t("cash.save")}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-5"
        data-testid="cash-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <SegmentedControl label={t("cash.title")} value={kind} onChange={setKind} options={CASH_KINDS.map((value) => ({ value, title: t(CASH_TITLES[value] as never) }))} />
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.amount} className="text-secondary text-primary-text">
            {t("cash.amount")}
          </label>
          <div className="flex min-h-12 items-center gap-2 rounded-medium bg-elevated-background px-3 focus-within:outline-2 focus-within:outline-accent desk:min-h-11">
            <AmountField
              id={ids.amount}
              value={amountText}
              onValueChange={setAmountText}
              inputMode="decimal"
              data-autofocus
              data-testid="cash-amount"
              className="min-w-0 flex-1 bg-transparent text-body text-primary-text outline-none"
            />
            <span className="text-body text-secondary-text">Kz</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.date} className="text-secondary text-primary-text">
            {t("common.date")}
          </label>
          <input
            id={ids.date}
            type="date"
            required
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            data-testid="cash-date"
            className="min-h-12 rounded-medium bg-elevated-background px-3 text-body text-primary-text desk:min-h-11"
          />
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/** `Movimentos`: newest first, signed amounts, each with `Apagar`. */
function MovementsDialog({ model, onAdd, onClose }: { model: PortfolioModel; onAdd: () => void; onClose: () => void }) {
  const t = useTranslations();
  const format = useFormat();
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("cash.movements")}
      footer={
        <Button kind="secondary" icon="add" onClick={onAdd}>
          {t("cash.add")}
        </Button>
      }
    >
      <ul className="flex flex-col divide-y divide-separator" data-testid="cash-list">
        {model.cash.map((movement) => (
          <li key={movement.id} className="flex min-h-14 items-center gap-3 py-2" data-testid="cash-row">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body text-primary-text">{t(CASH_TITLES[movement.kind] as never)}</span>
              <span className="text-caption text-secondary-text">{format.civilDate(movement.occurredOn)}</span>
            </span>
            <Private className="text-body font-semibold tabular-nums text-primary-text">{format.currency(signedCashAmount(movement), { signed: true })}</Private>
            <Button kind="destructive" className="w-auto! shrink-0" onClick={() => void model.store.deleteCash(movement.id)}>
              {t("common.delete")}
            </Button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

// MARK: Benchmark

const RATE_TITLES: Record<BenchmarkRate, string> = {
  inflation: "benchmark.inflation",
  policyRate: "benchmark.policyRate",
  luibor: "benchmark.luibor",
  treasuryBill: "benchmark.treasuryBill",
};

/** `Comparar com` (iOS `PortfolioBenchmarkSection`, Plus): the chart's range against a reference rate. */
export function BenchmarkSection({ model, points, quotes }: { model: PortfolioModel; points: readonly ValuePoint[]; quotes: readonly BenchmarkQuote[] | null }) {
  const t = useTranslations();
  const format = useFormat();
  const router = useRouter();
  const account = useAccount();
  const hidden = usePrivacyMode();
  const [picked, setPicked] = useState<BenchmarkRate | null>(null);
  const quote = quotes?.find((item) => item.rate === picked) ?? quotes?.[0];
  const benchmark = useMemo(
    () => (quote ? benchmarkSeries(points, model.transactions, model.priceScales, quote.value) : []),
    [quote, points, model.transactions, model.priceScales],
  );

  if (account && !account.unlocksPlus) {
    return (
      <Button kind="secondary" icon="chart" onClick={() => account.requestUpgrade("benchmark")} data-testid="benchmark-unlock">
        {t("benchmark.unlock")}
      </Button>
    );
  }
  if (quotes?.length === 0) return null;
  const last = points.at(-1);
  const reference = benchmark.at(-1);
  const difference = last && reference ? last.value.minus(reference.value) : null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="benchmark-title" data-testid="benchmark">
      <h3 id="benchmark-title" className="text-section text-primary-text">
        {t("benchmark.title")}
      </h3>
      {quotes === null ? (
        <Button kind="secondary" icon="refresh" onClick={() => router.refresh()}>
          {t("common.tryAgain")}
        </Button>
      ) : (
        <>
          <SegmentedControl
            label={t("benchmark.title")}
            value={quote!.rate}
            onChange={setPicked}
            options={quotes.map((item) => ({ value: item.rate, title: t(RATE_TITLES[item.rate] as never) }))}
          />
          {points.length < 2 || benchmark.length < 2 ? (
            <p className="text-secondary text-secondary-text">{t("portfolio.performance.chartUnavailable")}</p>
          ) : (
            <>
              {hidden ? null : <BenchmarkChart portfolio={points} benchmark={benchmark} />}
              <dl className="flex flex-col gap-2 text-secondary" data-testid="benchmark-legend">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="flex items-center gap-2 text-primary-text">
                    <span aria-hidden className="h-0.5 w-4 bg-accent" />
                    {t("common.portfolio")}
                  </dt>
                  <dd className="tabular-nums text-primary-text">{hidden ? <HiddenValue /> : format.currency(last!.value)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="flex items-center gap-2 text-primary-text">
                    <span aria-hidden className="w-4 border-t-2 border-dashed border-secondary-text" />
                    {`${t(RATE_TITLES[quote!.rate] as never)} · ${format.percent(quote!.value, { signed: false })}`}
                  </dt>
                  <dd className="tabular-nums text-primary-text">{hidden ? <HiddenValue /> : format.currency(reference!.value)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-primary-text">{t("benchmark.difference")}</dt>
                  <dd className={cn("font-semibold tabular-nums", difference && difference.gte(0) ? "text-positive" : "text-negative")} data-testid="benchmark-difference">
                    {hidden ? <HiddenValue /> : format.currency(difference!, { signed: true })}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </>
      )}
    </section>
  );
}

const CHART = { width: 320, height: 160, axis: 52 };

/** Portfolio (solid, accent) against the benchmark (dashed); compact value labels on the trailing edge. */
function BenchmarkChart({ portfolio, benchmark }: { portfolio: readonly ValuePoint[]; benchmark: readonly ValuePoint[] }) {
  const t = useTranslations();
  const format = useFormat();
  const { paths, ticks } = useMemo(() => {
    const values = [...portfolio, ...benchmark].map((point) => point.value);
    let low = Decimal.min(...values);
    let high = Decimal.max(...values);
    if (high.eq(low)) [low, high] = [low.minus(1), high.plus(1)];
    const span = high.minus(low);
    const plot = new Decimal(CHART.width - CHART.axis);
    const last = Math.max(portfolio.length - 1, 1);
    const y = (value: Decimal) => new Decimal(1).minus(value.minus(low).div(span)).times(CHART.height - 16).plus(8);
    const path = (points: readonly ValuePoint[]) =>
      points.map((point, index) => `${index === 0 ? "M" : "L"}${plot.times(index).div(last).toFixed(2)} ${y(point.value).toFixed(2)}`).join(" ");
    return {
      paths: [path(portfolio), path(benchmark)],
      ticks: [high, low.plus(span.div(2)), low].map((value) => ({ y: y(value).toFixed(2), label: format.chartAxis(value) })),
    };
  }, [portfolio, benchmark, format]);
  return (
    <svg role="img" aria-label={t("benchmark.title")} viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="h-40 w-full" data-testid="benchmark-chart">
      {ticks.map((tick) => (
        <text key={tick.y} x={CHART.width} y={tick.y} textAnchor="end" dominantBaseline="middle" className="fill-secondary-text text-[10px]">
          {tick.label}
        </text>
      ))}
      <path d={paths[1]} fill="none" strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" className="stroke-secondary-text" />
      <path d={paths[0]} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" className="stroke-accent" />
    </svg>
  );
}

// MARK: Results by year

/** `Resultados por ano` (iOS `PortfolioResultsSection`): realised gain and net income per year, each with its PDF report (Plus). */
export function ResultsSection({ model }: { model: PortfolioModel }) {
  const t = useTranslations();
  const format = useFormat();
  const account = useAccount();
  const scope = useSelectionTitle(model);
  const years = model.results.years.filter((year) => !year.realizedProfitLoss.isZero() || !year.netIncome.isZero());
  if (years.length === 0) return null;

  const download = (year: number) => {
    if (account && !account.unlocksPlus) return account.requestUpgrade("report");
    const rows = ledgerYearReport(model.transactions, year, { asOf: model.asOf, priceScales: model.priceScales });
    const bytes = yearReportPdf({
      rows,
      instrument: (id) => ({ symbol: model.instruments.get(id)?.symbol ?? id, name: model.instruments.get(id)?.name ?? "" }),
      currency: (value, signed) => format.currency(value, { digits: 2, signed }),
      labels: {
        app: t("common.appName"),
        title: t("report.title", { arg1: String(year) }),
        subtitle: `${scope} · ${t("report.generated", { arg1: format.maturity(luandaCivilDate(model.asOf)) })}`,
        instrument: t("report.instrument"),
        realizedGain: t("common.realizedGain"),
        netIncome: t("common.netIncome"),
        withheldTax: t("report.withheldTax"),
        commissions: t("report.commissions"),
        total: t("report.total"),
        method: t("report.method"),
      },
    });
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: reportFileName(year) });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="results-by-year" data-testid="results">
      <h3 id="results-by-year" className="text-section text-primary-text">
        {t("portfolio.results.byYear")}
      </h3>
      <ul className="flex flex-col gap-3">
        {years.map((year) => (
          <li key={year.year} className="flex flex-col gap-3 rounded-medium bg-elevated-background p-4" data-testid="results-year">
            <div className="flex items-center gap-3">
              <span className="flex-1 text-body font-semibold text-primary-text">{year.year}</span>
              <Button kind="secondary" icon="document" className="w-auto! shrink-0" onClick={() => download(year.year)} data-testid="report-pdf">
                {t("report.export")}
              </Button>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <dt className="text-caption text-secondary-text">{t("common.realizedGain")}</dt>
                <dd className={cn("text-body font-semibold tabular-nums", toneOf(year.realizedProfitLoss))}>
                  <Private>{format.currency(year.realizedProfitLoss, { signed: true })}</Private>
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-caption text-secondary-text">{t("common.netIncome")}</dt>
                <dd className="text-body font-semibold tabular-nums text-primary-text">
                  <Private>{format.currency(year.netIncome)}</Private>
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
