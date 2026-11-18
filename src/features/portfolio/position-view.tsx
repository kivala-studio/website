"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { nameBeyondSymbol } from "@/domain/market";
import type { CatalogueRow } from "@/features/market/browse/price-cell";
import { PrivacyModeButton } from "@/features/privacy/privacy-mode";
import { cn } from "@/ui/cn";
import { Button, buttonClass } from "@/ui/components/buttons";
import { Card, StatTile } from "@/ui/components/layout";
import { Menu } from "@/ui/components/menu";
import { SecurityLogo } from "@/ui/components/rows";
import { EmptyState, SectionPlaceholder } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { BackToPortfolio, Private, RecordsTable, toneOf } from "./portfolio-ui";
import { type EditorRequest, TransactionEditor } from "./transaction-editor";
import { usePortfolio } from "./use-portfolio";

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
          testID="record-menu"
          triggerClassName={buttonClass("primary", undefined, "compact")}
          trigger={
            <>
              <Icon name="add" />
              {t("portfolio.positionDetail.record")}
            </>
          }
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
      <div className="flex flex-col gap-6">
        {header}
        <Card>
          <SectionPlaceholder title={t("portfolio.positionDetail.title")} failed={model.status === "failed"} onRetry={() => void model.store.load()} />
        </Card>
      </div>
    );
  }
  if (!valuation && records.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Card>
          <EmptyState title={t("portfolio.positionDetail.unavailableTitle")} message={t("portfolio.positionDetail.unavailableMessage")} />
        </Card>
      </div>
    );
  }

  const position = valuation?.position;
  const bond = instrument?.bond ?? false;
  const metric = (title: string, value: string, tone?: string, personal = true) => (
    <StatTile key={title} label={title} value={<span className={cn("tabular-nums", tone)}>{personal ? <Private>{value}</Private> : value}</span>} />
  );

  const subtitle = instrument ? nameBeyondSymbol(instrument.name, instrument.symbol) : t("common.instrumentUnavailable");
  return (
    <div className="flex flex-col gap-6" data-testid="position">
      {header}
      <div className="flex items-center gap-4">
        <SecurityLogo symbol={instrument?.symbol ?? "—"} logoUrl={instrument?.logoURL} brandColor={bond ? "violet" : "blue"} size="l" />
        <span className="flex min-w-0 flex-col">
          <h1 className="text-display text-primary-text">{instrument?.symbol ?? t("portfolio.positionDetail.title")}</h1>
          {subtitle ? <span className="truncate text-secondary text-secondary-text">{subtitle}</span> : null}
        </span>
      </div>
      {position ? (
        <Card className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-secondary text-secondary-text">{t("common.currentValue")}</span>
            {valuation.currentValue ? (
              <Private className="font-display text-[clamp(1.75rem,8vw,2.75rem)] leading-tight font-semibold tracking-tight text-primary-text">
                <span data-testid="position-value">{format.currency(valuation.currentValue, { digits: 2 })}</span>
              </Private>
            ) : (
              <span className="text-body text-warning">{t("common.quoteUnavailable")}</span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" data-testid="position-metrics">
            {metric(bond ? t("common.faceValue") : t("common.quantity"), bond ? format.currency(position.quantity) : format.quantity(position.quantity))}
            {metric(t("portfolio.positionContent.averagePurchasePrice"), format.securityPrice(position.averagePurchasePrice, { bond }))}
            {metric(t("portfolio.positionContent.currentPrice"), valuation.currentPrice ? format.securityPrice(valuation.currentPrice, { bond }) : "—", undefined, false)}
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
        </Card>
      ) : null}
      <Card
        title={t("common.records")}
        titleId="position-records"
        flush
        action={
          <Button kind="outline" size="compact" icon="add" onClick={() => add("buy")}>
            {t("common.recordPurchase")}
          </Button>
        }
      >
        <RecordsTable
          records={records}
          instrument={(id) => model.instruments.get(id)}
          showSymbol={false}
          onEdit={(record) => setEditor({ mode: "edit", record })}
          onDelete={(record) => model.store.delete(record.id)}
        />
      </Card>
      <TransactionEditor request={editor} model={model} onClose={() => setEditor(null)} />
    </div>
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
        <h1 className="min-w-0 flex-1 text-display text-primary-text">{t("common.records")}</h1>
        <PrivacyModeButton />
      </header>
      {model.status !== "loaded" ? (
        <Card>
          <SectionPlaceholder title={t("common.records")} failed={model.status === "failed"} onRetry={() => void model.store.load()} />
        </Card>
      ) : model.transactions.length === 0 ? (
        <Card>
          <EmptyState icon="history" title={t("portfolio.emptyState.title")} message={t("portfolio.emptyState.message")} />
        </Card>
      ) : (
        <Card flush>
          <RecordsTable
            records={model.transactions}
            instrument={(id) => model.instruments.get(id)}
            onEdit={(record) => setEditor({ mode: "edit", record })}
            onDelete={(record) => model.store.delete(record.id)}
          />
        </Card>
      )}
      <TransactionEditor request={editor} model={model} onClose={() => setEditor(null)} />
    </div>
  );
}
