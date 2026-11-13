"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState } from "react";

import { type MarketSecurity, displayPriceChange, kindLabelKey, kindSearchTerms, searchSecurities } from "@/domain/market";
import { eligibleSecurities, hasPartialQuotes, simulationInstrument } from "@/domain/simulation/eligibility";
import {
  SIMULATION_FIELDS,
  type SimDecimal,
  type SimulationField,
  type SimulationResult,
  parseSimulationNumber,
  resultGain,
  validateDraftWith,
} from "@/domain/simulation/simulation";
import { useAccount } from "@/features/account/account-provider";
import { useMarketState, useMarketStore } from "@/features/market/market-provider";
import { cn } from "@/ui/cn";
import { AmountField } from "@/ui/components/amount-field";
import { Button, IconButton } from "@/ui/components/buttons";
import { SearchField } from "@/ui/components/controls";
import { Dialog } from "@/ui/components/dialog";
import { ChangeBadge } from "@/ui/components/financial";
import { Card } from "@/ui/components/layout";
import { SecurityLogo } from "@/ui/components/rows";
import { EmptyState, Spinner } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { useSimulationDraft } from "./draft-store";
import { SimulationChart } from "./simulation-chart";

type Translate = ReturnType<typeof useTranslations>;
const lookup = (t: Translate) => (key: string, values?: Record<string, string>) => t(key as never, values as never);

/** `1 ano`, `5 anos`, `18 meses`. */
function horizon(translate: Translate, months: number) {
  const t = lookup(translate);
  if (months % 12 === 0) return months === 12 ? t("common.oneYear") : t("simulation.duration.years", { arg1: String(months / 12) });
  return months === 1 ? t("common.oneMonth") : t("simulation.duration.months", { arg1: String(months) });
}

/** `/simulador` (iOS `SimulationMarketView`): eligible quotes from the tab's market store, then the calculator. */
export function Simulator() {
  const t = useTranslations();
  const account = useAccount();
  const market = useMarketState();
  const store = useMarketStore();
  const now = market.assessedAt;
  const snapshot = market.load.kind === "loaded" ? market.load.snapshot : undefined;
  const securities = useMemo(() => (snapshot && now !== undefined ? eligibleSecurities(snapshot.securities, now) : []), [snapshot, now]);
  const partial = snapshot !== undefined && now !== undefined && hasPartialQuotes(snapshot.securities, now, securities.length);

  if (market.load.kind === "failed" && !snapshot) {
    return (
      <div data-testid="simulation-error">
        <EmptyState
          icon="offline"
          title={t("simulation.market.quotesUnavailableTitle")}
          message={t("simulation.error.loadFailed") + t("simulation.error.retryAutomatically")}
          action={
            <Button kind="primary" icon="refresh" className="w-auto!" onClick={() => void store.load({ force: true })}>
              {t("common.tryAgain")}
            </Button>
          }
        />
      </div>
    );
  }
  if (!account || !snapshot || now === undefined) {
    return (
      <Card className="flex flex-col gap-4" data-testid="simulation-loading">
        <h2 className="text-section text-primary-text">{t("simulation.loading.title")}</h2>
        <span className="flex items-center gap-3 text-body text-secondary-text">
          <Spinner />
          {t("simulation.loading.fetchingQuotes")}
        </span>
      </Card>
    );
  }
  if (securities.length === 0) {
    return (
      <div data-testid="simulation-empty">
        <EmptyState
          icon="chart"
          title={t("simulation.market.noQuotesTitle")}
          message={t("simulation.market.noQuotesMessage")}
          action={
            <Button kind="secondary" icon="refresh" className="w-auto!" onClick={() => void store.load({ force: true })}>
              {t("common.tryAgain")}
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <Calculator
      userID={account.userID}
      securities={securities}
      now={now}
      partial={partial}
      refreshing={market.isRefreshing}
      onRefresh={() => void store.load({ force: true })}
    />
  );
}

function Calculator({
  userID,
  securities,
  now,
  partial,
  refreshing,
  onRefresh,
}: {
  userID: string;
  securities: readonly MarketSecurity[];
  now: number;
  partial: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const t = useTranslations();
  const format = useFormat();
  const [draft, update] = useSimulationDraft(userID);
  const [picking, setPicking] = useState(false);
  const [touched, setTouched] = useState<ReadonlySet<SimulationField>>(new Set());
  const [scrub, setScrub] = useState<number | null>(null);
  const security = securities.find((item) => item.id === draft.securityId);
  const instrument = security ? simulationInstrument(security, now) : null;
  const validation = useMemo(() => validateDraftWith(draft, instrument), [draft, instrument]);
  const result = validation.result;
  // A previously chosen instrument whose quote is no longer usable.
  const instrumentError = draft.securityId !== null ? validation.instrumentError : null;

  const money = (value: SimDecimal, signed = false) => format.currency(value.toString(), { digits: 2, signed });

  return (
    // Phones follow iOS (projection, controls, details); wide screens keep the controls beside both halves.
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8">
      <section className="flex flex-col gap-6 lg:col-start-1" aria-labelledby="simulation-headline">
        <InstrumentHeader security={security} onPick={() => setPicking(true)} error={instrumentError ? t(instrumentError as never) : null} />
        <Headline result={result} scrub={scrub} horizonMonths={result?.input.durationMonths} money={money} />
        {result ? (
          <SimulationChart
            result={result}
            selected={scrub}
            onSelect={setScrub}
            horizonLabel={horizon(t, result.input.durationMonths)}
            summary={t("simulation.chart.accessibilitySummary", {
              arg1: String(result.input.durationMonths),
              arg2: money(result.totalContributions),
              arg3: money(result.finalBalance),
            })}
          />
        ) : null}
      </section>
      <Card className="flex flex-col divide-y divide-separator py-0! lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1" data-testid="simulation-controls">
        {SIMULATION_FIELDS.map((field) => (
          <ScenarioRow
            key={field}
            field={field}
            value={draft[field]}
            error={(touched.has(field) || draft[field].trim() !== "") && validation.errors[field] ? t(validation.errors[field] as never) : null}
            onChange={(value) => update({ [field]: value })}
            onBlur={() => setTouched((current) => new Set(current).add(field))}
          />
        ))}
      </Card>
      <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-2">
        {result && security ? <Position result={result} symbol={security.symbol} money={money} /> : null}
        <QuoteFootnote security={security} partial={partial} refreshing={refreshing} onRefresh={onRefresh} />
        <Methodology />
      </div>
      {picking ? (
        <InstrumentPicker
          securities={securities}
          now={now}
          selectedId={draft.securityId}
          onPick={(id) => {
            update({ securityId: id });
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  );
}

function InstrumentHeader({ security, onPick, error }: { security: MarketSecurity | undefined; onPick: () => void; error: string | null }) {
  const t = useTranslations();
  const format = useFormat();
  return (
    <div className="flex flex-col gap-2">
      {security ? (
        <button
          type="button"
          onClick={onPick}
          className="flex min-h-14 w-full items-center gap-3 rounded-medium text-left"
          aria-haspopup="dialog"
          data-testid="simulation-instrument"
        >
          <SecurityLogo symbol={security.symbol} logoUrl={security.logoURL} size="s" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1 text-section text-primary-text">
              {security.symbol}
              <Icon name="chevron-down" className="size-4 text-secondary-text" />
            </span>
            <span className="truncate text-secondary text-secondary-text">{security.name}</span>
          </span>
          <span className="shrink-0 text-body font-semibold text-primary-text" title={t("simulation.quote.lastAvailable")}>
            {format.currency(security.price, { digits: 2 })}
          </span>
        </button>
      ) : (
        <Button kind="primary" icon="search" className="w-auto! self-start" onClick={onPick} data-testid="simulation-choose">
          {t("common.chooseInstrument")}
        </Button>
      )}
      {error ? (
        <p className="text-secondary text-negative" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Headline({
  result,
  scrub,
  horizonMonths,
  money,
}: {
  result: SimulationResult | null;
  scrub: number | null;
  horizonMonths: number | undefined;
  money: (value: SimDecimal, signed?: boolean) => string;
}) {
  const t = useTranslations();
  const format = useFormat();
  const point = result ? result.monthlyPoints[scrub ?? result.monthlyPoints.length - 1] : undefined;
  const label =
    !result || horizonMonths === undefined
      ? t("simulation.result.estimatedValue")
      : scrub === 0
        ? t("common.today")
        : t("simulation.result.atDate", {
            arg1: horizon(t, scrub ?? horizonMonths),
          });
  const gain = point
    ? resultGain({
        finalBalance: point.balance,
        totalContributions: point.contributions,
      })
    : undefined;
  const percent = gain && point && !point.contributions.isZero() ? gain.div(point.contributions).times(100) : undefined;
  const tone = !gain || gain.isZero() ? "text-secondary-text" : gain.isNegative() ? "text-negative" : "text-positive";
  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <span id="simulation-headline" className="text-secondary text-secondary-text">
        {label}
      </span>
      <span className="text-display break-all text-primary-text tabular-nums" data-testid="simulation-value">
        {point ? money(point.balance) : t("simulation.result.valuePlaceholder")}
      </span>
      {point && gain ? (
        <span className="flex flex-wrap gap-x-2 text-secondary" data-testid="simulation-gain">
          <span className={cn("font-semibold tabular-nums", tone)}>
            {money(gain, !gain.isZero())}
            {percent
              ? ` (${format.number(percent.toDecimalPlaces(1).toString(), { digits: percent.toDecimalPlaces(1).isInteger() ? 0 : 1, signed: !percent.isZero() })}%)`
              : null}
          </span>
          <span className="text-secondary-text">
            {t("simulation.result.ofInvested", {
              arg1: money(point.contributions),
            })}
          </span>
        </span>
      ) : null}
    </div>
  );
}

function Position({ result, symbol, money }: { result: SimulationResult; symbol: string; money: (value: SimDecimal) => string }) {
  const t = useTranslations();
  const format = useFormat();
  const quantity = (value: SimDecimal | undefined) => (value ? format.price(value.toSignificantDigits(10).toString()) : "—");
  const rows = [
    [t("simulation.result.initialUnits"), quantity(result.initialQuantity)],
    [t("simulation.result.finalUnits"), quantity(result.finalQuantity)],
    [t("simulation.result.hypotheticalFinalPrice", { arg1: symbol }), result.finalUnitPrice ? money(result.finalUnitPrice) : "—"],
    [t("simulation.result.uninvestedBalance"), result.uninvestedCash ? money(result.uninvestedCash) : "—"],
  ] as const;
  return (
    <dl className="flex flex-col divide-y divide-separator" data-testid="simulation-position">
      {rows.map(([title, value]) => (
        <div key={title} className="flex min-h-11 items-center justify-between gap-4 py-2">
          <dt className="text-secondary text-secondary-text">{title}</dt>
          <dd className="text-body font-semibold text-primary-text tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function QuoteFootnote({
  security,
  partial,
  refreshing,
  onRefresh,
}: {
  security: MarketSecurity | undefined;
  partial: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const t = useTranslations();
  const format = useFormat();
  const checked = security?.quoteQuality?.sourceObservedAtEpoch;
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-1 flex-col gap-1 text-caption text-secondary-text" data-testid="simulation-quote-footnote">
        {security ? (
          <>
            <span>
              {checked !== undefined && Number.isFinite(checked)
                ? t("simulation.quote.lastChecked", {
                    arg1: format.timestamp(checked * 1000),
                  })
                : t("simulation.quote.checkTimeUnavailable")}
            </span>
            {/* The market snapshot carries no last-trade time (iOS shows the same fallback). */}
            <span>{t("simulation.quote.lastTradeDateUnavailable")}</span>
          </>
        ) : null}
        {partial ? <span>{t("simulation.market.partialQuotesNotice")}</span> : null}
        <span>{t("simulation.quote.disclaimer")}</span>
      </div>
      {security ? <IconButton icon="refresh" label={t("simulation.quote.refresh")} onClick={onRefresh} disabled={refreshing} /> : null}
    </div>
  );
}

function Methodology() {
  const t = useTranslations();
  return (
    <details className="group rounded-large bg-card-background px-5 desk:panel" data-testid="simulation-methodology">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-body font-semibold text-primary-text">
        {t("simulation.methodology.title")}
        <Icon name="chevron-down" className="size-4 text-secondary-text transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="flex flex-col gap-3 pb-5 text-secondary text-secondary-text">
        <p>{t("simulation.methodology.quoteAndPrice")}</p>
        <p>{t("simulation.methodology.contributions")}</p>
        <p>{t("simulation.methodology.finalValue")}</p>
        <p>{t("legacy.limitesValoresAte1BiliaoKz")}</p>
      </div>
    </details>
  );
}

const PRESETS: Record<SimulationField, readonly string[]> = {
  initialInvestment: ["50000", "100000", "500000", "1000000"],
  monthlyContribution: ["0", "10000", "25000", "50000"],
  durationMonths: ["12", "36", "60", "120", "240"],
  annualReturnPercent: ["-10", "0", "5", "10", "15"],
};
const TITLES: Record<SimulationField, string> = {
  initialInvestment: "simulation.controls.initialInvestment",
  monthlyContribution: "simulation.controls.monthlyContribution",
  durationMonths: "simulation.controls.duration",
  annualReturnPercent: "simulation.controls.annualPriceChange",
};

function ScenarioRow({
  field,
  value,
  error,
  onChange,
  onBlur,
}: {
  field: SimulationField;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const t = useTranslations();
  const format = useFormat();
  const id = useId();
  const errorID = `${id}-error`;
  const amount = field === "initialInvestment" || field === "monthlyContribution";
  const current =
    field === "durationMonths" ? (/^\s*[0-9]+\s*$/.test(value) ? value.trim().replace(/^0+(?=\d)/, "") : null) : parseSimulationNumber(value)?.toString();
  const compact = new Intl.NumberFormat(format.locale === "pt" ? "pt-AO" : "en-AO", { notation: "compact" });
  const presetLabel = (preset: string) => {
    if (field === "durationMonths") return horizon(t, Number(preset));
    if (field === "annualReturnPercent") return `${preset === "0" ? "" : preset.startsWith("-") ? "−" : "+"}${preset.replace("-", "")}%`;
    return compact.format(Number(preset));
  };
  const presetValue = (preset: string) => (amount ? format.number(preset, { digits: 2 }) : preset);
  const input = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorID : undefined,
    onFocus: (event: { currentTarget: HTMLInputElement }) => event.currentTarget.select(),
    // `!`: the amount field sets its own size and colour, and `cn` does not merge Tailwind classes.
    className: cn("text-right text-section! font-semibold", error ? "text-negative!" : "text-accent!"),
  };
  return (
    <div className="flex flex-col gap-3 py-4" data-testid={`scenario-${field}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <label htmlFor={id} className="text-body font-semibold text-primary-text">
          {t(TITLES[field] as never)}
        </label>
        <div className="w-full sm:w-56">
          {amount ? (
            <AmountField {...input} value={value} onValueChange={onChange} onBlur={onBlur} suffix="Kz" />
          ) : (
            <span className="flex min-h-12 items-center gap-2 rounded-medium bg-elevated-background px-4 focus-within:outline-2 focus-within:outline-accent">
              <input
                {...input}
                type="text"
                inputMode={field === "durationMonths" ? "numeric" : "text"}
                autoComplete="off"
                spellCheck={false}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                className={cn("min-w-0 flex-1 bg-transparent py-3 outline-none", input.className)}
              />
              <span className="text-body text-secondary-text">{field === "durationMonths" ? t("simulation.controls.monthsUnit") : "%"}</span>
            </span>
          )}
        </div>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none]" role="group" aria-label={t(TITLES[field] as never)}>
        {PRESETS[field].map((preset) => {
          const selected = current === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onChange(presetValue(preset));
                onBlur();
              }}
              className={cn(
                "min-h-11 min-w-11 shrink-0 rounded-full px-4 text-secondary font-semibold transition-colors motion-reduce:transition-none",
                selected ? "bg-accent-soft text-accent" : "bg-elevated-background text-secondary-text",
              )}
            >
              {presetLabel(preset)}
            </button>
          );
        })}
      </div>
      {error ? (
        <p id={errorID} className="text-secondary text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function InstrumentPicker({
  securities,
  now,
  selectedId,
  onPick,
  onClose,
}: {
  securities: readonly MarketSecurity[];
  now: number;
  selectedId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const format = useFormat();
  const [query, setQuery] = useState("");
  const resultsID = useId();
  const translate = (key: string) => t(key as never);
  const candidates = useMemo(
    () =>
      query.trim() === ""
        ? securities
        : searchSecurities(securities, query, {
            now,
            kindTerms: kindSearchTerms(translate),
          }),
    [securities, query, now], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // The picker closes when its quotes change underneath it (iOS closes it on every refresh).
  const [initial] = useState(securities);
  useEffect(() => {
    if (initial !== securities && !securities.some((item) => item.id === selectedId)) onClose();
  }, [initial, securities, selectedId, onClose]);

  return (
    <Dialog open onClose={onClose} title={t("common.chooseInstrument")}>
      <div className="flex flex-col gap-3" data-testid="simulation-picker">
        <SearchField value={query} onChange={setQuery} placeholder={t("common.symbolNameOrIssuer")} controls={resultsID} autoFocus />
        {candidates.length === 0 ? (
          <div className="py-8">
            <EmptyState icon="search" title={t("common.noResults")} />
          </div>
        ) : (
          <ul id={resultsID} className="flex flex-col divide-y divide-hairline">
            {candidates.map((security) => {
              const change = displayPriceChange(security, now);
              const selected = security.id === selectedId;
              return (
                <li key={security.id}>
                  <button
                    type="button"
                    onClick={() => onPick(security.id)}
                    aria-pressed={selected}
                    className="flex min-h-16 w-full items-center gap-3 py-2 text-left"
                    data-testid="picker-row"
                  >
                    <SecurityLogo symbol={security.symbol} logoUrl={security.logoURL} size="s" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body font-semibold text-primary-text">
                        {security.symbol} <span className="text-caption font-normal text-secondary-text">{t(kindLabelKey(security.kind) as never)}</span>
                      </span>
                      <span className="truncate text-secondary text-secondary-text">{security.name}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-body font-semibold text-primary-text tabular-nums">{format.currency(security.price, { digits: 2 })}</span>
                      {change !== undefined ? <ChangeBadge value={change} /> : null}
                    </span>
                    <Icon name={selected ? "check-circle" : "add"} className={selected ? "text-accent" : "text-secondary-text"} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
