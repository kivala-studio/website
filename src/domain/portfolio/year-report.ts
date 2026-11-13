import Decimal from "decimal.js";

import { PdfPage, fitText, pdfBytes } from "../pdf/document";
import type { PortfolioInstrumentYear } from "./models";

/*
 * iOS `PortfolioYearReport`: one year's realised gains, net income, withheld tax and commissions per
 * instrument, A4 portrait, always black on white. 22 rows per page; the totals row on the last page.
 */

export const reportFileName = (year: number) => `invest-ao-relatorio-${year}.pdf`;

const PAGE = { width: 595, height: 842, margin: 44 };
const ROWS_PER_PAGE = 22;
const ROW_HEIGHT = 25;

export type YearReportLabels = {
  app: string;
  title: string;
  /** `{portfolio} · Gerado a {date}`. */
  subtitle: string;
  instrument: string;
  realizedGain: string;
  netIncome: string;
  withheldTax: string;
  commissions: string;
  total: string;
  method: string;
};

export type YearReportInput = {
  rows: readonly PortfolioInstrumentYear[];
  instrument: (securityId: string) => { symbol: string; name: string };
  /** AOA, two decimals; `signed` adds a sign to a non-zero amount. */
  currency: (value: Decimal, signed: boolean) => string;
  labels: YearReportLabels;
};

export type YearReportTotals = Pick<PortfolioInstrumentYear, "realizedProfitLoss" | "netIncome" | "withheldTax" | "commissions">;

export function yearReportTotals(rows: readonly PortfolioInstrumentYear[]): YearReportTotals {
  const sum = (pick: (row: PortfolioInstrumentYear) => Decimal) => rows.reduce((total, row) => total.plus(pick(row)), new Decimal(0));
  return { realizedProfitLoss: sum((row) => row.realizedProfitLoss), netIncome: sum((row) => row.netIncome), withheldTax: sum((row) => row.withheldTax), commissions: sum((row) => row.commissions) };
}

export function yearReportPdf({ rows, instrument, currency, labels }: YearReportInput): Uint8Array {
  const { width, height, margin } = PAGE;
  const right = width - margin;
  const columns = [right - 3 * 92, right - 2 * 92, right - 92, right];
  const instrumentWidth = columns[0] - 80 - margin;
  const chunks: (readonly PortfolioInstrumentYear[])[] = [];
  for (let start = 0; start < Math.max(rows.length, 1); start += ROWS_PER_PAGE) chunks.push(rows.slice(start, start + ROWS_PER_PAGE));
  const totals = yearReportTotals(rows);
  const amounts = (values: YearReportTotals) => [
    currency(values.realizedProfitLoss, !values.realizedProfitLoss.isZero()),
    currency(values.netIncome, false),
    currency(values.withheldTax, false),
    currency(values.commissions, false),
  ];

  const pages = chunks.map((chunk, index) => {
    const page = new PdfPage(width, height);
    let y = margin + 11;
    page.text(labels.app, margin, y, { size: 11, font: "bold", gray: 0.45 });
    y += 26;
    page.text(labels.title, margin, y, { size: 22, font: "bold" });
    y += 16;
    page.text(labels.subtitle, margin, y, { size: 10, gray: 0.45 });
    y += 30;
    page.text(labels.instrument, margin, y, { size: 9, font: "bold", gray: 0.45 });
    [labels.realizedGain, labels.netIncome, labels.withheldTax, labels.commissions].forEach((title, column) =>
      page.text(title, columns[column], y, { size: 9, font: "bold", gray: 0.45, align: "right" }),
    );
    y += 7;
    page.rule(margin, right, y);
    for (const row of chunk) {
      const { symbol, name } = instrument(row.securityId);
      y += 14;
      page.text(fitText(symbol, instrumentWidth + 80, 10, "bold"), margin, y, { size: 10, font: "bold" });
      amounts(row).forEach((text, column) => page.text(text, columns[column], y, { size: 9, align: "right" }));
      page.text(fitText(name, instrumentWidth, 8), margin, y + 10, { size: 8, gray: 0.45 });
      y += ROW_HEIGHT - 14;
    }
    if (index === chunks.length - 1) {
      y += 7;
      page.rule(margin, right, y);
      y += 14;
      page.text(labels.total, margin, y, { size: 10, font: "bold" });
      amounts(totals).forEach((text, column) => page.text(text, columns[column], y, { size: 9, font: "bold", align: "right" }));
    }
    page.text(labels.method, margin, height - margin, { size: 8, gray: 0.45 });
    page.text(`${index + 1}/${chunks.length}`, right, height - margin, { size: 8, gray: 0.45, align: "right" });
    return page;
  });
  return pdfBytes(pages, labels.title);
}
