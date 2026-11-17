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
import { Card, StatTile } from "@/ui/components/layout";
import { SecurityLogo } from "@/ui/components/rows";
import { DataTable, TableCell, TableHead, TableHeaderCell, TableNameCell, TableRow } from "@/ui/components/table";
import { SectionPlaceholder, Spinner } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { Private } from "./portfolio-ui";
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
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 text-display text-primary-text">{t("income.title")}</h1>
        <PrivacyModeButton />
      </header>
      {model.status !== "loaded" ? (
        <Card>
          <SectionPlaceholder title={t("income.title")} failed={model.status === "failed"} onRetry={() => void model.store.load()} />
        </Card>
      ) : securities.length === 0 ? (
        <Spinner className="mx-auto size-6 text-secondary-text" />
      ) : (
        <>
          <Totals events={events} today={today} />
          <Card title={t("income.section.upcoming")} titleId="income-upcoming" flush={upcoming.length > 0} data-testid="income-upcoming">
            {upcoming.length === 0 ? (
              <p className="text-body text-secondary-text">{t("income.empty.upcoming")}</p>
            ) : (
              <IncomeTable items={upcoming} model={model} />
            )}
          </Card>
          {past.length > 0 ? (
            <Card title={t("income.section.past")} titleId="income-past" flush data-testid="income-past">
              <IncomeTable items={past} model={model} onRecord={record} />
            </Card>
          ) : null}
        </>
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
      <Card>
        <Button kind="secondary" icon="lock" onClick={() => account.requestUpgrade("income")} data-testid="income-unlock">
          {t("income.plus.locked")}
        </Button>
      </Card>
    );
  }
  const totals = incomeTotals(events, today);
  return (
    <Card className="flex flex-col gap-4">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="income-totals">
        {[
          { title: t("income.total.next12"), value: totals.next12Months },
          { title: t("income.total.last12"), value: totals.last12Months },
        ].map((tile) => (
          <StatTile
            key={tile.title}
            size="large"
            label={tile.title}
            value={<Private className="tabular-nums">{format.currency(tile.value, { digits: 2 })}</Private>}
          />
        ))}
      </dl>
      <p className="flex items-center gap-2 text-secondary text-secondary-text" data-testid="income-reminders">
        <Icon name="notification" />
        {t("site.portfolio.remindersInApps")}
      </p>
    </Card>
  );
}

/** Payments as a table: instrument, kind, date, amount with its status or `Registar` (past, unrecorded). */
function IncomeTable({ items, model, onRecord }: { items: readonly IncomeEvent[]; model: PortfolioModel; onRecord?: (item: IncomeEvent) => void }) {
  const t = useTranslations();
  return (
    <DataTable>
      <TableHead>
        <TableHeaderCell>{t("common.instrument")}</TableHeaderCell>
        <TableHeaderCell className="max-sm:hidden">{t("assetDetails.marketInfo.type")}</TableHeaderCell>
        <TableHeaderCell className="max-sm:hidden">{t("common.date")}</TableHeaderCell>
        <TableHeaderCell align="right">{t("cash.amount")}</TableHeaderCell>
      </TableHead>
      <tbody>
        {items.map((item) => (
          <IncomeRow key={item.id} item={item} model={model} onRecord={onRecord ? () => onRecord(item) : undefined} />
        ))}
      </tbody>
    </DataTable>
  );
}

function IncomeRow({ item, model, onRecord }: { item: IncomeEvent; model: PortfolioModel; onRecord?: () => void }) {
  const t = useTranslations();
  const format = useFormat();
  const instrument = model.instruments.get(item.securityId);
  const kind = t(KIND_KEYS[item.kind]);
  const date = format.civilDate(item.date);
  return (
    <TableRow data-testid="income-row" data-status={item.status}>
      <TableNameCell
        logo={<SecurityLogo symbol={instrument?.symbol ?? "?"} logoUrl={instrument?.logoURL} size="s" />}
        name={instrument?.symbol ?? t("common.instrumentUnavailable")}
        detail={<span className="sm:hidden">{`${kind} · ${date}`}</span>}
      />
      <TableCell className="max-sm:hidden">{kind}</TableCell>
      <TableCell className="whitespace-nowrap max-sm:hidden">{date}</TableCell>
      <TableCell numeric>
        <span className="flex flex-col items-end gap-1 py-2">
          <Private className="font-semibold tabular-nums">{format.currency(item.amount, { digits: 2 })}</Private>
          {item.status === "recorded" ? (
            <span className="flex items-center gap-1 font-sans text-caption text-positive">
              <Icon name="check" />
              {t("income.status.recorded")}
            </span>
          ) : item.status === "unrecorded" && onRecord ? (
            <Button kind="outline" size="compact" onClick={onRecord} data-testid="income-record">
              {t("income.action.record")}
            </Button>
          ) : null}
        </span>
      </TableCell>
    </TableRow>
  );
}
