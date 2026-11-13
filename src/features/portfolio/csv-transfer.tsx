"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { CSV_FILE_NAME, type CsvIssue, type CsvRow, decodeCsvBytes, exportCsv, parseCsv } from "@/domain/portfolio/csv";
import { Button } from "@/ui/components/buttons";
import { Dialog } from "@/ui/components/dialog";
import { useToast } from "@/ui/components/feedback";
import { Menu } from "@/ui/components/menu";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { Private } from "./portfolio-ui";
import type { PortfolioModel } from "./use-portfolio";

const ISSUE_KEYS: Record<CsvIssue, string> = {
  missingColumns: "portfolio.csvTransfer.missingColumns",
  unknownSymbol: "portfolio.csvTransfer.instrumentNotFound",
  unsupportedInstrument: "portfolio.csvTransfer.instrumentUnsupported",
  invalidDate: "portfolio.csvTransfer.invalidDate",
  invalidKind: "portfolio.csvTransfer.invalidType",
  invalidNumber: "portfolio.csvTransfer.invalidNumber",
  invalidRecord: "portfolio.csvTransfer.invalidValues",
  duplicate: "portfolio.csvTransfer.alreadyRecorded",
};

const KIND_KEYS = { buy: "common.buy", sell: "common.sell", income: "portfolio.csvTransfer.income" } as const;

/** `Exportar ou importar`: the ledger as `invest-ao-carteira.csv` (iOS format), or a file read into a review. */
export function CsvTransfer({ model }: { model: PortfolioModel }) {
  const t = useTranslations();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[] | null>(null);

  const download = () => {
    const csv = exportCsv(model.transactions, [...model.instruments.values()]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: CSV_FILE_NAME });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const read = async (file: File | undefined) => {
    if (!file) return;
    const text = file.size > 2 * 1024 * 1024 ? null : decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
    if (text === null) return toast.show({ title: t("portfolio.csvTransfer.readFailed"), message: t("portfolio.csvTransfer.chooseFile") });
    const parsed = parseCsv(text, { securities: [...model.instruments.values()], existing: model.transactions, asOf: Date.now() });
    if (parsed.length === 0) return toast.show({ title: t("portfolio.csvTransfer.readFailed"), message: t("portfolio.csvTransfer.emptyFile") });
    setRows(parsed);
  };

  return (
    <>
      <Menu
        label={t("portfolio.csvTransfer.exportOrImport")}
        testID="csv-menu"
        entries={[
          ...(model.transactions.length > 0 ? [{ kind: "item" as const, label: t("portfolio.csvTransfer.export"), icon: "download" as const, onSelect: download, testID: "csv-export" }] : []),
          { kind: "item", label: t("portfolio.csvTransfer.import"), icon: "upload", onSelect: () => input.current?.click(), testID: "csv-import" },
        ]}
      />
      <input
        ref={input}
        type="file"
        accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
        hidden
        data-testid="csv-file"
        onChange={(event) => {
          void read(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {rows ? <ImportReview rows={rows} model={model} onClose={() => setRows(null)} /> : null}
    </>
  );
}

/** `Importar registos`: every line with its reason or what it records; saves the valid ones oldest first. */
function ImportReview({ rows, model, onClose }: { rows: CsvRow[]; model: PortfolioModel; onClose: () => void }) {
  const t = useTranslations();
  const format = useFormat();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const valid = rows.flatMap((row) => (row.transaction ? [row.transaction] : []));

  const save = async () => {
    setSaving(true);
    const ordered = [...valid].sort((a, b) => (a.tradedOn < b.tradedOn ? -1 : a.tradedOn > b.tradedOn ? 1 : 0));
    const { saved, result } = await model.store.importTransactions(ordered);
    setSaving(false);
    if (result === "saved") return onClose();
    if (saved > 0) {
      toast.show({ title: t("portfolio.csvTransfer.importIncomplete"), message: t("portfolio.csvTransfer.importedCount", { arg1: format.count(saved), arg2: format.count(valid.length) }) });
    } else if (result !== "failed") {
      toast.show({ title: t("portfolio.error.saveFailed"), message: t("portfolio.csvTransfer.invalidPortfolio") });
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("portfolio.csvTransfer.importRecords")}
      footer={
        <Button icon="check" className="w-full" disabled={valid.length === 0} loading={saving} onClick={save} data-testid="csv-confirm">
          {t("portfolio.csvTransfer.importCount", { arg1: format.count(valid.length) })}
        </Button>
      }
    >
      <ul className="flex flex-col divide-y divide-hairline" data-testid="csv-review">
        {rows.map((row) => {
          const record = row.transaction;
          const instrument = record ? model.instruments.get(record.securityId) : undefined;
          return (
            <li key={row.line} className="flex min-h-14 items-start gap-3 py-3" data-testid="csv-row">
              <Icon name={record ? "check-circle" : "warning"} className={record ? "text-positive" : "text-warning"} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-body font-semibold text-primary-text">
                  {row.symbol ? `${row.symbol} · ${t("portfolio.csvTransfer.lineLabel", { arg1: format.count(row.line) })}` : t("portfolio.csvTransfer.lineTitle", { arg1: format.count(row.line) })}
                </span>
                {record ? (
                  <Private className="text-secondary text-secondary-text">
                    {[
                      t(KIND_KEYS[record.kind]),
                      record.kind === "income"
                        ? format.currency(record.unitPrice)
                        : `${format.quantity(record.quantity)} × ${format.securityPrice(record.unitPrice, { bond: instrument?.bond ?? false }).replace(/\s*Kz$/, "")}`,
                      format.civilDate(record.tradedOn),
                    ].join(" · ")}
                  </Private>
                ) : (
                  <span className="text-secondary text-secondary-text">{t(ISSUE_KEYS[row.issue!] as never)}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
