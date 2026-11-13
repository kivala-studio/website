"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { CatalogueRow } from "@/features/market/browse/price-cell";
import { PrivacyModeButton } from "@/features/privacy/privacy-mode";
import { cn } from "@/ui/cn";
import { Button } from "@/ui/components/buttons";
import { Menu } from "@/ui/components/menu";
import { SecurityLogo } from "@/ui/components/rows";
import { EmptyState, SectionPlaceholder } from "@/ui/components/states";
import { useFormat } from "@/ui/format";

import { BackToPortfolio, Private, RecordRow, toneOf } from "./portfolio-ui";
import { type EditorRequest, TransactionEditor } from "./transaction-editor";
import { type PortfolioModel, usePortfolio } from "./use-portfolio";

/** `/carteira/[id]` (iOS `PortfolioPositionDetailView`): one holding's figures and its records. */
export function PositionView({ securityId, rows, renderedAt }: { securityId: string; rows: readonly CatalogueRow[]; renderedAt: number }) {
  const t = useTranslations();
  const format = useFormat();
  const model = usePortfolio(rows, renderedAt);
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const instrument = model.instruments.get(securityId);
  const valuation = model.valuations.find((item) => item.position.securityId === securityId);
  const records = model.recordsOf(securityId);
  const add = (kind: "buy" | "sell" | "income") => setEditor({ mode: "add", kind, securityId });

  const header = (
    <header className="flex flex-wrap items-center gap-3">
      <BackToPortfolio />
      <span className="flex-1" />
      <PrivacyModeButton />
      {instrument ? (
        <Menu
          label={t("portfolio.positionDetail.record")}
          icon="add"
          testID="record-menu"
          trigger={<span>{t("portfolio.positionDetail.record")}</span>}
          entries={[
            { kind: "item", label: t("common.recordPurchase"), icon: "add", onSelect: () => add("buy"), testID: "record-buy" },
            { kind: "item", label: t("common.recordSale"), icon: "remove", onSelect: () => add("sell"), testID: "record-sell" },
            { kind: "item", label: t("common.recordIncome"), icon: "dividend", onSelect: () => add("income"), testID: "record-income" },
          ]}
        />
      ) : null}
    </header>
  );

  if (model.status !== "loaded") {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <SectionPlaceholder title={t("portfolio.positionDetail.title")} failed={model.status === "failed"} onRetry={() => void model.store.load()} />
      </div>
    );
  }
  if (!valuation && records.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <EmptyState title={t("portfolio.positionDetail.unavailableTitle")} message={t("portfolio.positionDetail.unavailableMessage")} />
      </div>
    );
  }

  const position = valuation?.position;
  const bond = instrument?.bond ?? false;
  const metric = (title: string, value: string, tone = "text-primary-text", personal = true) => (
    <div key={title} className="flex flex-col gap-1 rounded-medium bg-elevated-background p-4">
      <dt className="text-caption text-secondary-text">{title}</dt>
      <dd className={cn("text-body font-semibold tabular-nums", tone)}>{personal ? <Private>{value}</Private> : value}</dd>
    </div>
  );

  return (
    <div className="flex flex-col gap-8" data-testid="position">
      {header}
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <SecurityLogo symbol={instrument?.symbol ?? "—"} logoUrl={instrument?.logoURL} brandColor={bond ? "violet" : "blue"} size="l" />
            <span className="flex min-w-0 flex-col">
              <h1 className="text-display text-primary-text">{instrument?.symbol ?? t("portfolio.positionDetail.title")}</h1>
              <span className="truncate text-secondary text-secondary-text">{instrument?.name ?? t("common.instrumentUnavailable")}</span>
            </span>
          </div>
          {position ? (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-secondary text-secondary-text">{t("common.currentValue")}</span>
                {valuation.currentValue ? (
                  <Private className="text-headline text-primary-text">
                    <span data-testid="position-value">{format.currency(valuation.currentValue, { digits: 2 })}</span>
                  </Private>
                ) : (
                  <span className="text-body text-warning">{t("common.quoteUnavailable")}</span>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-3" data-testid="position-metrics">
                {metric(bond ? t("common.faceValue") : t("common.quantity"), bond ? format.currency(position.quantity) : format.quantity(position.quantity))}
                {metric(t("portfolio.positionContent.averagePurchasePrice"), format.securityPrice(position.averagePurchasePrice, { bond }))}
                {metric(t("portfolio.positionContent.currentPrice"), valuation.currentPrice ? format.securityPrice(valuation.currentPrice, { bond }) : "—", "text-primary-text", false)}
                {metric(t("common.investedAmount"), format.currency(position.investedAmount))}
                {metric(
                  t("portfolio.positionContent.gainLoss"),
                  valuation.unrealizedProfitLoss ? format.currency(valuation.unrealizedProfitLoss, { signed: true }) : "—",
                  toneOf(valuation.unrealizedProfitLoss),
                )}
                {metric(t("common.performance"), valuation.returnPercentage ? format.percent(valuation.returnPercentage) : "—", toneOf(valuation.returnPercentage))}
                {!position.realizedProfitLoss.isZero()
                  ? metric(t("common.realizedGain"), format.currency(position.realizedProfitLoss, { signed: true }), toneOf(position.realizedProfitLoss))
                  : null}
                {!position.netIncome.isZero() ? metric(t("common.netIncome"), format.currency(position.netIncome)) : null}
              </dl>
            </>
          ) : null}
        </section>
        <PositionRecords model={model} securityId={securityId} onRecord={() => add("buy")} onEdit={setEditor} />
      </div>
      <TransactionEditor request={editor} model={model} onClose={() => setEditor(null)} />
    </div>
  );
}

function PositionRecords({
  model,
  securityId,
  onRecord,
  onEdit,
}: {
  model: PortfolioModel;
  securityId: string;
  onRecord: () => void;
  onEdit: (request: EditorRequest) => void;
}) {
  const t = useTranslations();
  return (
    <section aria-labelledby="position-records" className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h2 id="position-records" className="flex-1 text-section text-primary-text">
          {t("common.records")}
        </h2>
        <Button kind="secondary" icon="add" onClick={onRecord}>
          {t("common.recordPurchase")}
        </Button>
      </div>
      <ul className="flex flex-col">
        {model.recordsOf(securityId).map((record) => (
          <RecordRow
            key={record.id}
            record={record}
            instrument={model.instruments.get(securityId)}
            showSymbol={false}
            onEdit={() => onEdit({ mode: "edit", record })}
            onDelete={() => model.store.delete(record.id)}
          />
        ))}
      </ul>
    </section>
  );
}

/** `/carteira/registos` (iOS records list): every record, newest first. */
export function RecordsView({ rows, renderedAt }: { rows: readonly CatalogueRow[]; renderedAt: number }) {
  const t = useTranslations();
  const model = usePortfolio(rows, renderedAt);
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  return (
    <div className="flex flex-col gap-6" data-testid="records">
      <header className="flex flex-wrap items-center gap-3">
        <BackToPortfolio />
        <h1 className="min-w-0 flex-1 text-display text-primary-text">{t("common.records")}</h1>
        <PrivacyModeButton />
      </header>
      {model.status !== "loaded" ? (
        <SectionPlaceholder title={t("common.records")} failed={model.status === "failed"} onRetry={() => void model.store.load()} />
      ) : (
        <ul className="flex max-w-3xl flex-col">
          {model.transactions.map((record) => (
            <RecordRow
              key={record.id}
              record={record}
              instrument={model.instruments.get(record.securityId)}
              onEdit={() => setEditor({ mode: "edit", record })}
              onDelete={() => model.store.delete(record.id)}
            />
          ))}
        </ul>
      )}
      <TransactionEditor request={editor} model={model} onClose={() => setEditor(null)} />
    </div>
  );
}
