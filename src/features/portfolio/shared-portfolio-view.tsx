"use client";

import Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import type { SharedTransaction } from "@/data/portfolio/shared-portfolio";
import { currentQuotePrices } from "@/domain/market";
import { type PortfolioTransaction, ledgerPositions, portfolioPriceScale, portfolioSummary, validateLedger, valuePositions } from "@/domain/portfolio";
import { useMarketState } from "@/features/market/market-provider";
import { cn } from "@/ui/cn";
import { ChangeBadge, FinancialValue } from "@/ui/components/financial";
import { SecurityLogo } from "@/ui/components/rows";
import { Skeleton } from "@/ui/components/states";
import { useFormat } from "@/ui/format";

/** What the page knows about an instrument in the shared ledger. */
export type SharedInstrument = { id: string; symbol: string; name: string; securityType: string; bond: boolean; currency: string };

/**
 * A read-only shared portfolio: positions from the W2 ledger calculator, valued in the browser at
 * current public prices once the market store has them. No cash, no amounts on the server page.
 */
export function SharedPortfolioView({
  transactions,
  instruments,
  asOf,
}: {
  transactions: SharedTransaction[];
  instruments: SharedInstrument[];
  /** The server's request time: rows traded after its Luanda day invalidate the ledger. */
  asOf: number;
}) {
  const t = useTranslations();
  const format = useFormat();
  const state = useMarketState();
  const snapshot = state.load.kind === "loaded" ? state.load.snapshot : undefined;
  const at = state.assessedAt;
  const byID = useMemo(() => new Map(instruments.map((instrument) => [instrument.id, instrument])), [instruments]);

  const ledger = useMemo(() => {
    const rows: PortfolioTransaction[] = transactions.map((row) => ({
      id: row.id,
      securityId: row.securityId,
      kind: row.kind,
      quantity: new Decimal(row.quantity),
      unitPrice: new Decimal(row.unitPrice),
      fees: new Decimal(row.fees),
      tradedOn: row.tradedOn,
      createdAt: row.createdAt,
    }));
    const priceScales = Object.fromEntries(instruments.map((instrument) => [instrument.id, portfolioPriceScale(instrument.securityType)]));
    return { valid: validateLedger(rows, { asOf }) === "valid", positions: ledgerPositions(rows, { asOf, priceScales }) };
  }, [transactions, instruments, asOf]);

  const prices = useMemo(() => (snapshot && at !== undefined ? Object.fromEntries(currentQuotePrices(snapshot.securities, at)) : undefined), [snapshot, at]);
  const valuations = useMemo(() => valuePositions(ledger.positions, prices ?? {}), [ledger.positions, prices]);
  const summary = prices ? portfolioSummary(valuations) : undefined;
  const priced = valuations.length - (summary?.missingPriceCount ?? valuations.length);

  if (!ledger.valid) {
    return <p className="text-body text-secondary-text">{t("portfolio.summary.valueUnavailable")}</p>;
  }

  return (
    <div className="flex flex-col gap-8" data-testid="shared-portfolio">
      <section aria-labelledby="value" className="flex flex-col gap-2">
        <h2 id="value" className="text-secondary text-secondary-text">
          {t("common.portfolioValue")}
        </h2>
        {summary === undefined ? (
          <Skeleton className="h-12 w-56" />
        ) : priced === 0 ? (
          <p className="text-body text-secondary-text">{valuations.length ? t("portfolio.summary.noQuotes") : t("portfolio.summary.valueUnavailable")}</p>
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-3">
              <FinancialValue value={summary.currentValue} style="display" className="text-[clamp(1.375rem,9vw,2.75rem)]" />
              <ChangeBadge value={summary.returnPercentage} />
            </p>
            {summary.missingPriceCount > 0 ? (
              <p className="text-caption text-secondary-text">
                {summary.missingPriceCount === 1
                  ? t("portfolio.summary.missingQuoteOne")
                  : t("portfolio.summary.missingQuotesCount", { arg1: format.count(summary.missingPriceCount) })}
              </p>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="positions" className="flex flex-col gap-1">
        <h2 id="positions" className="text-section text-primary-text">
          {t("common.instruments")}
        </h2>
        <ul className="flex flex-col">
          {valuations.map((valuation) => {
            const instrument = byID.get(valuation.position.securityId);
            const symbol = instrument?.symbol ?? "—";
            return (
              <li key={valuation.position.securityId} className="flex min-h-18 items-center gap-3 border-b border-separator py-3 last:border-b-0">
                <SecurityLogo symbol={symbol} brandColor={instrument?.bond ? "violet" : "blue"} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-body font-semibold text-primary-text">{symbol}</span>
                  <span className="text-caption text-secondary-text">
                    {`${t("common.quantity")}: ${format.quantity(valuation.position.quantity)}`}
                  </span>
                </span>
                <span className={cn("flex flex-col items-end gap-1")}>
                  {prices === undefined ? (
                    <Skeleton className="h-5 w-24" />
                  ) : valuation.currentValue ? (
                    <>
                      <FinancialValue value={valuation.currentValue} className="text-body font-semibold" />
                      {valuation.returnPercentage ? <ChangeBadge value={valuation.returnPercentage} /> : null}
                    </>
                  ) : (
                    <span className="text-secondary text-secondary-text">{t("common.priceUnconfirmed")}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
