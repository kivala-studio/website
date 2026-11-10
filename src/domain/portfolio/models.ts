import type Decimal from "decimal.js";

import type { CivilDate, Instant, Numeric } from "../format";

export type PortfolioTransactionKind = "buy" | "sell" | "income";

/**
 * One ledger row. Bonds record nominal AOA as `quantity` and percent of nominal as `unitPrice`.
 * Income is one gross payment in `unitPrice` (quantity 1) with withheld tax in `fees`.
 */
export type PortfolioTransaction = {
  id: string;
  securityId: string;
  kind: PortfolioTransactionKind;
  quantity: Decimal;
  unitPrice: Decimal;
  fees: Decimal;
  tradedOn: CivilDate;
  /** ISO-8601 with an offset, as the server sends it. Orders rows traded on the same day. */
  createdAt: string;
  /** null or absent is the main portfolio. */
  portfolioId?: string | null;
};

/** Price scale per security id. Omitted securities use 1; bonds use 0.01. */
export type PriceScales = Readonly<Record<string, Numeric>>;

export type LedgerOptions = {
  /** Rows traded after this instant's Luanda day invalidate the ledger. */
  asOf: Instant;
  priceScales?: PriceScales;
};

/** `valid`, or the data-quality reason that rejects the whole ledger. */
export type LedgerValidity = "valid" | "invalidLedger" | "duplicateObservation";

export type PortfolioPosition = {
  securityId: string;
  purchases: PortfolioTransaction[];
  quantity: Decimal;
  /** Remaining cost basis in AOA, including purchase fees. */
  investedAmount: Decimal;
  /** In quote units: AOA per unit, or percent of nominal for bonds. */
  averagePurchasePrice: Decimal;
  priceScale: Decimal;
  realizedProfitLoss: Decimal;
  netIncome: Decimal;
};

export type PortfolioValuation = {
  position: PortfolioPosition;
  currentPrice: Decimal | null;
  currentValue: Decimal | null;
  unrealizedProfitLoss: Decimal | null;
  returnPercentage: Decimal | null;
};

export type PortfolioSummary = {
  investedAmount: Decimal;
  currentValue: Decimal;
  unrealizedProfitLoss: Decimal;
  returnPercentage: Decimal;
  missingPriceCount: number;
};

export type PortfolioAllocation = {
  securityId: string;
  currentValue: Decimal;
  percentage: Decimal;
};

export type PortfolioResultsYear = {
  year: number;
  realizedProfitLoss: Decimal;
  netIncome: Decimal;
  fees: Decimal;
};

export type PortfolioResults = {
  /** Newest first. */
  years: PortfolioResultsYear[];
  realizedProfitLoss: Decimal;
  netIncome: Decimal;
  hasEntries: boolean;
};

export type PortfolioInstrumentYear = {
  securityId: string;
  realizedProfitLoss: Decimal;
  netIncome: Decimal;
  withheldTax: Decimal;
  commissions: Decimal;
};

/** A close: an instant or a Luanda civil day. */
export type HistoryPoint = { date: Instant | CivilDate; value: Numeric };

export type ValuePoint = { day: CivilDate; value: Decimal };

export type ValueSeriesOptions = LedgerOptions & {
  /** Days back from the `asOf` day; null for the whole history. */
  rangeDays: number | null;
};

export type PortfolioPeriodChange = {
  amount: Decimal;
  /** null when the period starts at zero. */
  percentage: Decimal | null;
};
