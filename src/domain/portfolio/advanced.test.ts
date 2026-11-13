import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { benchmarkSeries } from "./benchmark";
import { COMBINED, MAIN, bookName, resolveSelection, selectionIncludes } from "./books";
import { cashSummary } from "./cash";
import { ledgerYearReport } from "./calculator";
import { incomeEvents, incomeTotals } from "./income-calendar";
import type { PortfolioTransaction } from "./models";
import { statementCsv } from "./statement";
import { yearReportPdf, yearReportTotals } from "./year-report";

let sequence = 0;
const tx = (securityId: string, kind: PortfolioTransaction["kind"], quantity: Decimal.Value, unitPrice: Decimal.Value, tradedOn: string, fees: Decimal.Value = 0): PortfolioTransaction => ({
  id: `10000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
  securityId,
  kind,
  quantity: new Decimal(quantity),
  unitPrice: new Decimal(unitPrice),
  fees: new Decimal(fees),
  tradedOn,
  createdAt: `${tradedOn}T12:00:00Z`,
  portfolioId: null,
});
const cash = (kind: "deposit" | "withdrawal" | "fee", amount: Decimal.Value) => ({ id: `c${++sequence}`, kind, amount: new Decimal(amount), occurredOn: "2026-01-02", portfolioId: null });

describe("cash", () => {
  it("nets deposits, fees and the ledger's trades into the balance (iOS PortfolioCash)", () => {
    const ledger = [tx("bai", "buy", 10, 60000, "2026-01-05", 1200), tx("bai", "sell", 2, 65000, "2026-03-01", 300), tx("bai", "income", 1, 5000, "2026-06-01", 500)];
    const summary = cashSummary([cash("deposit", 1000000), cash("withdrawal", 100000), cash("fee", 5000)], ledger);
    expect([summary.netDeposited, summary.fees, summary.balance].map((value) => value.toFixed())).toEqual(["900000", "5000", "428000"]);
  });
});

describe("benchmark", () => {
  const points = (...days: [string, number][]) => days.map(([day, value]) => ({ day, value: new Decimal(value) }));

  it("compounds continuously at ln(1 + rate) / 365 and adds later buys", () => {
    const series = benchmarkSeries(points(["2026-01-01", 100000], ["2027-01-01", 0]), [tx("bai", "buy", 1, 50000, "2026-07-02")], {}, new Decimal(10));
    const expected = 100000 * 1.1 + 50000 * 1.1 ** (183 / 365);
    expect(series[0].value.toNumber()).toBe(100000);
    expect(series[1].value.toNumber()).toBeCloseTo(expected, 6);
  });

  it("never goes below zero and refuses a rate of −100 % or less", () => {
    const series = benchmarkSeries(points(["2026-01-01", 1000], ["2026-02-01", 0]), [tx("bai", "sell", 1, 5000, "2026-01-10")], {}, new Decimal(5));
    expect(series[1].value.toFixed()).toBe("0");
    expect(benchmarkSeries(points(["2026-01-01", 1000]), [], {}, new Decimal(-100))).toEqual([]);
  });
});

describe("income calendar", () => {
  const today = "2026-11-13";
  const securities = [
    { id: "bai", symbol: "BAI", kind: "equity" as const, issuerID: "ISSUER-BAI" },
    { id: "ot", symbol: "OT15I27A", kind: "treasuryBond" as const },
  ];
  const dividend = (paymentDate: string, exDividendDate: string | null, recordDate: string | null) => ({ issuerId: "issuer-bai", amountPerShare: new Decimal(10), exDividendDate, recordDate, paymentDate });

  it("entitles by ex-date, then record date, then payment, and marks past payments recorded within 42 days", () => {
    const ledger = [tx("bai", "buy", 100, 1000, "2026-03-01"), tx("bai", "buy", 50, 1000, "2026-06-10"), tx("bai", "income", 1, 1000, "2026-07-15")];
    const events = incomeEvents({
      transactions: ledger,
      securities,
      dividends: [dividend("2026-02-01", null, null), dividend("2026-06-20", "2026-06-10", null), dividend("2026-10-01", null, null), dividend("2026-12-28", null, "2026-12-20")],
      today,
    });
    expect(events.map((event) => [event.date, event.quantity.toFixed(), event.amount.toFixed(), event.status])).toEqual([
      ["2026-06-20", "100", "1000", "recorded"],
      ["2026-10-01", "150", "1500", "unrecorded"],
      ["2026-12-28", "150", "1500", "upcoming"],
    ]);
    const totals = incomeTotals(events, today);
    expect([totals.next12Months.toFixed(), totals.last12Months.toFixed()]).toEqual(["1500", "2500"]);
  });

  it("adds coupons from saved terms (the last on the maturity day) and the redemption from the bond symbol", () => {
    const events = incomeEvents({
      transactions: [tx("ot", "buy", 1000000, 100, "2026-01-10")],
      securities,
      dividends: [],
      bondTerms: { ot: { couponRate: new Decimal(16), frequency: 2 } },
      today,
    });
    expect(events.map((event) => [event.kind, event.date, event.amount.toFixed(), event.status])).toEqual([
      ["coupon", "2026-05-15", "80000", "unrecorded"],
      ["coupon", "2026-11-15", "80000", "upcoming"],
      ["coupon", "2027-05-15", "80000", "upcoming"],
      ["maturity", "2027-05-15", "1000000", "upcoming"],
    ]);
  });
});

describe("statement text", () => {
  const securities = [{ symbol: "BAI" }, { symbol: "BFA" }];

  it("reads dates, grouped thousands, kinds and income, and carries the last date", () => {
    const csv = statementCsv(["Extrato 05/01/2026", "Compra BAI 100 61.000,50", "2026-03-02 Venda BFA 20 x 101.5", "Dividendo BAI 4 500,00", "Saldo 1 000 000"], securities);
    expect(csv).toBe(
      ["data;simbolo;tipo;quantidade;preco;custos", "2026-01-05;BAI;compra;100;61000,50;0", "2026-03-02;BFA;venda;20;101.5;0", "2026-03-02;BAI;rendimento;1;4500,00;0", ""].join("\n"),
    );
  });

  it("finds nothing without a known symbol", () => {
    expect(statementCsv(["01/02/2026 Compra XYZ 10 100"], securities)).toBeNull();
  });
});

describe("named portfolios", () => {
  const books = [{ id: "b1", name: "Reforma" }];

  it("falls back to the combined view and filters by portfolio", () => {
    expect([resolveSelection("b1", books), resolveSelection("gone", books), resolveSelection(MAIN, []), resolveSelection(MAIN, books)]).toEqual(["b1", COMBINED, COMBINED, MAIN]);
    expect([selectionIncludes(MAIN, null), selectionIncludes(MAIN, "b1"), selectionIncludes("b1", "b1"), selectionIncludes(COMBINED, "b1")]).toEqual([true, false, true, true]);
    expect([bookName("  Reforma "), bookName("   "), bookName("x".repeat(41))]).toEqual(["Reforma", null, null]);
  });
});

describe("year report", () => {
  it("totals the year's rows and writes a PDF with a valid cross-reference table", () => {
    const ledger = [tx("bai", "buy", 10, 1000, "2025-03-01", 50), tx("bai", "sell", 5, 1500, "2026-02-01", 20), tx("bai", "income", 1, 900, "2026-06-01", 100)];
    const rows = ledgerYearReport(ledger, 2026, { asOf: Date.UTC(2026, 10, 13, 11) });
    const totals = yearReportTotals(rows);
    expect([totals.realizedProfitLoss.toFixed(), totals.netIncome.toFixed()]).toEqual(["2455", "800"]);

    const label = "x";
    const bytes = yearReportPdf({
      rows,
      instrument: () => ({ symbol: "BAI", name: "Banco BAI" }),
      currency: (value) => `${value.toFixed(2)} Kz`,
      labels: { app: label, title: label, subtitle: label, instrument: label, realizedGain: label, netIncome: label, withheldTax: label, commissions: label, total: label, method: label },
    });
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe("xref");
    for (const [, offset, number] of text.slice(xref).matchAll(/(\d{10}) 00000 n[\s\S]*?/g).map((match, index) => [match, Number(match[1]), index + 1] as const))
      expect(text.slice(offset, offset + String(number).length + 6)).toBe(`${number} 0 obj`);
  });
});
