"use client";

import { useTranslations } from "next-intl";

import { MARKET_MESSAGE_KEYS, type MarketSecurity, displayPercentageChange, displayPrice, displayPriceLabel } from "@/domain/market";
import { cn } from "@/ui/cn";
import { ChangeBadge, FinancialValue } from "@/ui/components/financial";
import { useFormat } from "@/ui/format";

/** An instrument as the server sends it to list rows: identity and the dated verified close. */
export type CatalogueRow = {
  id: string;
  symbol: string;
  name: string;
  issuer: string;
  kind: MarketSecurity["kind"];
  bond: boolean;
  currency: string;
  logoURL?: string;
  close?: { price: string; date: string; change?: string };
};

/**
 * The figure a row may show: a current price once the store has assessed it as usable, otherwise the
 * dated verified close (rendered by the server, so cached HTML never holds a current price), otherwise
 * "Preço por confirmar". A last quote that is no longer current falls back to the close.
 */
export function rowFigure(row: CatalogueRow | undefined, security: MarketSecurity | undefined, at: number | undefined) {
  if (security && at !== undefined) {
    const label = displayPriceLabel(security, at);
    const price = displayPrice(security, at);
    if (label && price && label !== MARKET_MESSAGE_KEYS.price.lastQuote) {
      return { kind: "current" as const, price: price.toString(), change: displayPercentageChange(security, at)?.toString() };
    }
  }
  if (row?.close) return { kind: "close" as const, price: row.close.price, date: row.close.date, change: row.close.change };
  return { kind: "none" as const };
}

export function PriceCell({
  row,
  security,
  at,
  inlineChange,
  className,
}: {
  row: CatalogueRow | undefined;
  security: MarketSecurity | undefined;
  at: number | undefined;
  /** Classes for the change badge under a current price, e.g. to hide it where a change column shows it. */
  inlineChange?: string;
  className?: string;
}) {
  const t = useTranslations();
  const format = useFormat();
  const figure = rowFigure(row, security, at);
  const bond = row?.bond ?? false;
  const code = row?.currency ?? security?.currency ?? "AOA";
  if (figure.kind === "none") return <span className={cn("text-secondary text-secondary-text", className)}>{t("common.priceUnconfirmed")}</span>;
  return (
    <span className={cn("flex flex-col items-end gap-1", className)}>
      <FinancialValue value={figure.price} bond={bond} code={code} className="text-body font-semibold" />
      {figure.kind === "close" ? (
        <span className="text-caption text-secondary-text">
          <span className="sr-only">{t(MARKET_MESSAGE_KEYS.price.lastVerifiedClose, { arg1: format.civilDate(figure.date) })}</span>
          <span aria-hidden>{format.civilDate(figure.date)}</span>
        </span>
      ) : figure.change !== undefined ? (
        <ChangeBadge value={figure.change} className={inlineChange} />
      ) : null}
    </span>
  );
}

export function ChangeCell({ row, security, at }: { row: CatalogueRow | undefined; security: MarketSecurity | undefined; at: number | undefined }) {
  const figure = rowFigure(row, security, at);
  return figure.kind !== "none" && figure.change !== undefined ? <ChangeBadge value={figure.change} /> : <span aria-hidden className="text-tertiary-text">—</span>;
}
