"use client";

import type Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import type { PortfolioTransaction } from "@/domain/portfolio";
import { usePrivacyMode } from "@/features/privacy/privacy-mode";
import { cn } from "@/ui/cn";
import { Button } from "@/ui/components/buttons";
import { Dialog } from "@/ui/components/dialog";
import { HiddenValue } from "@/ui/components/feedback";
import { Menu } from "@/ui/components/menu";
import { DataTable, TableCell, TableHead, TableHeaderCell, TableRow } from "@/ui/components/table";
import { Link } from "@/i18n/navigation";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import type { SaveResult } from "./portfolio-store";
import type { PortfolioInstrument } from "./use-portfolio";

export const toneOf = (value: Decimal | null | undefined) =>
  !value || value.isZero()
    ? "text-secondary-text"
    : value.gt(0)
      ? "text-positive"
      : "text-negative";

/** `120 ações`, `35,5 unidades`, or the nominal in AOA for bonds. */
export function useQuantityText() {
  const t = useTranslations();
  const format = useFormat();
  return (
    quantity: Decimal,
    instrument: Pick<PortfolioInstrument, "kind" | "bond"> | undefined,
  ) => {
    if (instrument?.bond) return format.currency(quantity);
    const unit =
      instrument?.kind === "equity"
        ? t("portfolio.holdingRow.stocksUnit")
        : t("legacy.unidades");
    return `${format.quantity(quantity)} ${unit}`;
  };
}

/** A personal figure: its text, or only the mask in privacy mode (the value is not in the page). */
export function Private({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const hidden = usePrivacyMode();
  return hidden ? (
    <HiddenValue className={className} />
  ) : (
    <span className={className}>{children}</span>
  );
}

export const KIND_KEYS = {
  buy: "common.buy",
  sell: "common.sell",
  income: "portfolio.csvTransfer.income",
} as const;

/** `Compra · 10 ações · 12 500,00 Kz · 150,00 Kz em custos`; income `Rendimento · 1 234,00 Kz`. */
export function useRecordDetail() {
  const t = useTranslations();
  const format = useFormat();
  const quantityText = useQuantityText();
  return (
    record: PortfolioTransaction,
    instrument: PortfolioInstrument | undefined,
  ) => {
    const parts = [t(KIND_KEYS[record.kind])];
    if (record.kind !== "income") {
      parts.push(quantityText(record.quantity, instrument));
      parts.push(
        format.securityPrice(record.unitPrice, {
          bond: instrument?.bond ?? false,
        }),
      );
    } else parts.push(format.currency(record.unitPrice, { digits: 2 }));
    if (record.fees.gt(0))
      parts.push(
        t("legacy.emCustos", {
          arg1: format.currency(record.fees, { digits: 2 }),
        }),
      );
    return parts.join(" · ");
  };
}

/**
 * The records table (CoinStats "Transactions"): instrument, date, kind, quantity, price and fees, with an
 * options menu per row. Below 768 px the row keeps the date and the masked detail line under the instrument.
 */
export function RecordsTable({
  records,
  instrument,
  showSymbol = true,
  onEdit,
  onDelete,
  testID,
}: {
  records: readonly PortfolioTransaction[];
  instrument: (securityId: string) => PortfolioInstrument | undefined;
  showSymbol?: boolean;
  onEdit: (record: PortfolioTransaction) => void;
  onDelete: (record: PortfolioTransaction) => Promise<SaveResult>;
  testID?: string;
}) {
  const t = useTranslations();
  return (
    <DataTable data-testid={testID}>
      <TableHead>
        <TableHeaderCell>{showSymbol ? t("common.instrument") : t("common.date")}</TableHeaderCell>
        {showSymbol ? <TableHeaderCell className="max-md:hidden">{t("common.date")}</TableHeaderCell> : null}
        <TableHeaderCell className="max-md:hidden">{t("assetDetails.marketInfo.type")}</TableHeaderCell>
        <TableHeaderCell align="right" className="max-md:hidden">
          {t("common.quantity")}
        </TableHeaderCell>
        <TableHeaderCell align="right" className="max-md:hidden">
          {t("common.price")}
        </TableHeaderCell>
        <TableHeaderCell align="right" className="max-lg:hidden">
          {t("portfolio.form.fees")}
        </TableHeaderCell>
        <TableHeaderCell align="right">
          <span className="sr-only">{t("portfolio.purchaseRow.options")}</span>
        </TableHeaderCell>
      </TableHead>
      <tbody>
        {records.map((record) => (
          <RecordRow
            key={record.id}
            record={record}
            instrument={instrument(record.securityId)}
            showSymbol={showSymbol}
            onEdit={() => onEdit(record)}
            onDelete={() => onDelete(record)}
          />
        ))}
      </tbody>
    </DataTable>
  );
}

/** One record: its columns, the masked detail line on phones, an options menu (edit, delete with confirmation). */
function RecordRow({
  record,
  instrument,
  showSymbol,
  onEdit,
  onDelete,
}: {
  record: PortfolioTransaction;
  instrument: PortfolioInstrument | undefined;
  showSymbol: boolean;
  onEdit: () => void;
  onDelete: () => Promise<SaveResult>;
}) {
  const t = useTranslations();
  const format = useFormat();
  const detail = useRecordDetail();
  const quantityText = useQuantityText();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refused, setRefused] = useState(false);
  const remove = async () => {
    setDeleting(true);
    const result = await onDelete();
    setDeleting(false);
    if (result === "saved") setConfirming(false);
    else if (result !== "failed") setRefused(true);
  };
  const date = format.civilDate(record.tradedOn);
  const income = record.kind === "income";
  return (
    <TableRow data-testid="record-row">
      <TableCell>
        <span className="flex min-w-0 flex-col gap-0.5 py-2">
          <span className="font-medium text-primary-text">{showSymbol ? (instrument?.symbol ?? t("common.instrumentUnavailable")) : date}</span>
          {showSymbol ? <span className="font-sans text-caption text-secondary-text md:hidden">{date}</span> : null}
          <Private className="font-sans text-caption text-secondary-text md:hidden">{detail(record, instrument)}</Private>
        </span>
      </TableCell>
      {showSymbol ? <TableCell className="whitespace-nowrap max-md:hidden">{date}</TableCell> : null}
      <TableCell className="max-md:hidden">{t(KIND_KEYS[record.kind])}</TableCell>
      <TableCell numeric className="max-md:hidden">
        {income ? <span className="text-tertiary-text">—</span> : <Private>{quantityText(record.quantity, instrument)}</Private>}
      </TableCell>
      <TableCell numeric className="max-md:hidden">
        <Private>
          {income ? format.currency(record.unitPrice, { digits: 2 }) : format.securityPrice(record.unitPrice, { bond: instrument?.bond ?? false })}
        </Private>
      </TableCell>
      <TableCell numeric className="max-lg:hidden">
        {record.fees.gt(0) ? <Private>{format.currency(record.fees, { digits: 2 })}</Private> : <span className="text-tertiary-text">—</span>}
      </TableCell>
      <TableCell numeric className="w-14">
        <Menu
          label={t("portfolio.purchaseRow.options")}
          entries={[
            {
              kind: "item",
              label: t("portfolio.purchaseRow.editRecord"),
              icon: "edit",
              onSelect: onEdit,
            },
            {
              kind: "item",
              label: t("common.deleteRecord"),
              icon: "trash",
              destructive: true,
              onSelect: () => (setRefused(false), setConfirming(true)),
            },
          ]}
        />
        {confirming ? (
          // The dialog is a child of the cell: reset what the numeric cell would hand down to it.
          <div className="contents text-left font-sans font-normal whitespace-normal">
            <Dialog
              variant="dialog"
              open
              onClose={() => setConfirming(false)}
              title={t("portfolio.purchaseRow.deleteTitle")}
              footer={
                <div className="flex w-full flex-col gap-2 sm:flex-row-reverse">
                  <Button
                    kind="destructive"
                    className="w-full"
                    loading={deleting}
                    onClick={remove}
                    data-testid="confirm-delete"
                  >
                    {t("common.deleteRecord")}
                  </Button>
                  <Button
                    kind="secondary"
                    className="w-full"
                    onClick={() => setConfirming(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              }
            >
              <p
                className={cn(
                  "text-body",
                  refused ? "text-negative" : "text-primary-text",
                )}
                role={refused ? "alert" : undefined}
              >
                {refused
                  ? t("portfolio.csvTransfer.invalidPortfolio")
                  : t("portfolio.purchaseRow.deleteMessage")}
              </p>
            </Dialog>
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

/** Back to the dashboard. */
export function BackToPortfolio() {
  const t = useTranslations();
  return (
    <Link
      href="/carteira"
      className="inline-flex min-h-11 items-center gap-1 text-body font-semibold text-accent"
    >
      <Icon name="chevron-left" />
      {t("common.portfolio")}
    </Link>
  );
}
