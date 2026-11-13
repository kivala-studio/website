"use client";

import Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { luandaCivilDate } from "@/domain/format/date";
import { isBondKind } from "@/domain/market/classification";
import { type IncomeEvent, type IssuerDividend, incomeEvents, incomeTotals } from "@/domain/portfolio/income-calendar";
import { useAccount } from "@/features/account/account-provider";
import type { CatalogueRow } from "@/features/market/browse/price-cell";
import { useSavedBondTerms } from "@/features/market/instrument/bond-yield-dialog";
import { PrivacyModeButton } from "@/features/privacy/privacy-mode";
import { Button } from "@/ui/components/buttons";
import { SecurityLogo } from "@/ui/components/rows";
import { SectionPlaceholder, Spinner } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { BackToPortfolio, Private } from "./portfolio-ui";
import { type EditorRequest, TransactionEditor } from "./transaction-editor";
import { type PortfolioModel, usePortfolio } from "./use-portfolio";

/** An `issuer_dividends` row as the server page hands it over (amounts as text). */
export type DividendWire = Omit<IssuerDividend, "amountPerShare"> & { amountPerShare: string };

const KIND_KEYS = { dividend: "income.kind.dividend", coupon: "income.kind.coupon", maturity: "income.kind.maturity" } as const;

/** `/carteira/rendimentos` (iOS `IncomeCalendarView`): payments the ledger entitles the holder to. */
export function IncomeView({ rows, renderedAt, dividends }: { rows: readonly CatalogueRow[]; renderedAt: number; dividends: readonly DividendWire[] }) {
  const t = useTranslations();
  const model = usePortfolio(rows, renderedAt);
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const securities = useMemo(() => [...model.securities.values()], [model.securities]);
  const bonds = useMemo(() => securities.filter((security) => isBondKind(security.kind)), [securities]);
  const bondTerms = useSavedBondTerms(bonds);
  const today = luandaCivilDate(model.asOf);
  const events = useMemo(
    () =>
      incomeEvents({
        transactions: model.transactions,
        securities,
        dividends: dividends.map((item) => ({ ...item, amountPerShare: new Decimal(item.amountPerShare) })),
        bondTerms,
        today,
      }),
    [model.transactions, securities, dividends, bondTerms, today],
  );
  const upcoming = events.filter((item) => item.status === "upcoming");
  const past = events.filter((item) => item.status !== "upcoming").reverse();
  const record = (item: IncomeEvent) =>
    setEditor({ mode: "add", kind: "income", securityId: item.securityId, prefill: { price: item.amount.toDecimalPlaces(2), date: item.date } });

  return (
    <div className="flex flex-col gap-6" data-testid="income">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <BackToPortfolio />
          <PrivacyModeButton />
        </div>
        <h1 className="text-display text-primary-text">{t("income.title")}</h1>
      </header>
      {model.status !== "loaded" ? (
        <SectionPlaceholder title={t("income.title")} failed={model.status === "failed"} onRetry={() => void model.store.load()} />
      ) : securities.length === 0 ? (
        <Spinner className="mx-auto size-6 text-secondary-text" />
      ) : (
        <div className="flex max-w-3xl flex-col gap-6">
          <Totals events={events} today={today} />
          <section className="flex flex-col gap-2" data-testid="income-upcoming">
            <h2 className="text-section text-primary-text">{t("income.section.upcoming")}</h2>
            {upcoming.length === 0 ? (
              <p className="py-4 text-body text-secondary-text">{t("income.empty.upcoming")}</p>
            ) : (
              <ul className="flex flex-col">
                {upcoming.map((item) => (
                  <IncomeRow key={item.id} item={item} model={model} />
                ))}
              </ul>
            )}
          </section>
          {past.length > 0 ? (
            <section className="flex flex-col gap-2" data-testid="income-past">
              <h2 className="text-section text-primary-text">{t("income.section.past")}</h2>
              <ul className="flex flex-col">
                {past.map((item) => (
                  <IncomeRow key={item.id} item={item} model={model} onRecord={() => record(item)} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
      <TransactionEditor request={editor} model={model} onClose={() => setEditor(null)} />
    </div>
  );
}

/** Plus: the two totals, and where the payment-day reminders live. Free: one row that opens the plan dialog. */
function Totals({ events, today }: { events: readonly IncomeEvent[]; today: string }) {
  const t = useTranslations();
  const format = useFormat();
  const account = useAccount();
  if (account && !account.unlocksPlus) {
    return (
      <Button kind="secondary" icon="lock" onClick={() => account.requestUpgrade("income")} data-testid="income-unlock">
        {t("income.plus.locked")}
      </Button>
    );
  }
  const totals = incomeTotals(events, today);
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-3" data-testid="income-totals">
        {[
          { title: t("income.total.next12"), value: totals.next12Months },
          { title: t("income.total.last12"), value: totals.last12Months },
        ].map((tile) => (
          <div key={tile.title} className="flex flex-col gap-1 rounded-medium bg-elevated-background p-4">
            <dt className="text-caption text-secondary-text">{tile.title}</dt>
            <dd className="text-body font-semibold tabular-nums text-primary-text">
              <Private>{format.currency(tile.value, { digits: 2 })}</Private>
            </dd>
          </div>
        ))}
      </dl>
      <p className="flex items-center gap-2 text-secondary text-secondary-text" data-testid="income-reminders">
        <Icon name="notification" />
        {t("site.portfolio.remindersInApps")}
      </p>
    </div>
  );
}

function IncomeRow({ item, model, onRecord }: { item: IncomeEvent; model: PortfolioModel; onRecord?: () => void }) {
  const t = useTranslations();
  const format = useFormat();
  const instrument = model.instruments.get(item.securityId);
  return (
    <li className="flex min-h-16 items-center gap-3 border-b border-separator py-3 last:border-b-0" data-testid="income-row" data-status={item.status}>
      <SecurityLogo symbol={instrument?.symbol ?? "?"} logoUrl={instrument?.logoURL} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-body font-semibold text-primary-text">{instrument?.symbol ?? t("common.instrumentUnavailable")}</span>
        <span className="text-caption text-secondary-text">{`${t(KIND_KEYS[item.kind])} · ${format.civilDate(item.date)}`}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <Private className="text-body font-semibold tabular-nums text-primary-text">{format.currency(item.amount, { digits: 2 })}</Private>
        {item.status === "recorded" ? (
          <span className="flex items-center gap-1 text-caption text-positive">
            <Icon name="check" />
            {t("income.status.recorded")}
          </span>
        ) : item.status === "unrecorded" && onRecord ? (
          <Button kind="secondary" className="w-auto!" onClick={onRecord} data-testid="income-record">
            {t("income.action.record")}
          </Button>
        ) : null}
      </span>
    </li>
  );
}
