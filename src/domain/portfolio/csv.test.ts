import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { exportCsv, parseCsv } from "./csv";
import type { PortfolioTransaction } from "./models";

// Ported from iOS `PortfolioCSVTests`.
const securities = [
  { id: "bai", symbol: "BAI", name: "Banco BAI", kind: "equity" as const },
  { id: "ot", symbol: "OT26A", name: "OT; 2026", kind: "treasuryBond" as const },
];
const asOf = Date.parse("2026-11-01T12:00:00+01:00");
let next = 0;
const newID = () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;

const record = (id: number, securityId: string, kind: PortfolioTransaction["kind"], quantity: string, unitPrice: string, fees: string, tradedOn: string): PortfolioTransaction => ({
  id: `10000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  securityId,
  kind,
  quantity: new Decimal(quantity),
  unitPrice: new Decimal(unitPrice),
  fees: new Decimal(fees),
  tradedOn,
  createdAt: `${tradedOn}T09:00:00Z`,
});

describe("portfolio CSV", () => {
  const ledger = [
    record(3, "bai", "income", "1", "5000", "500", "2026-06-01"),
    record(1, "bai", "buy", "10", "61000.5", "120", "2026-01-05"),
    record(2, "ot", "buy", "250000", "98.75", "0", "2026-02-01"),
  ];

  it("exports the iOS format and round-trips, skipping existing records", () => {
    const csv = exportCsv(ledger, securities);
    expect(csv.split("\r\n")).toEqual([
      "data;simbolo;instrumento;tipo;quantidade;preco;custos;valor_liquido;moeda",
      "2026-01-05;BAI;Banco BAI;compra;10;61000,5;120;610125;AOA",
      '2026-02-01;OT26A;"OT; 2026";compra;250000;98,75;0;246875;AOA',
      "2026-06-01;BAI;Banco BAI;rendimento;1;5000;500;4500;AOA",
      "",
    ]);
    const fresh = parseCsv(csv, { securities, asOf, newID });
    expect(fresh.map((row) => row.issue)).toEqual([undefined, undefined, undefined]);
    const imported = fresh.map((row) => row.transaction!);
    const ordered = [ledger[1], ledger[2], ledger[0]];
    for (const [index, transaction] of imported.entries()) {
      const original = ordered[index];
      expect([transaction.securityId, transaction.kind, transaction.tradedOn]).toEqual([original.securityId, original.kind, original.tradedOn]);
      expect([transaction.quantity.toFixed(), transaction.unitPrice.toFixed(), transaction.fees.toFixed()]).toEqual([
        original.quantity.toFixed(),
        original.unitPrice.toFixed(),
        original.fees.toFixed(),
      ]);
    }
    expect(parseCsv(csv, { securities, existing: ledger, asOf, newID }).every((row) => row.issue === "duplicate")).toBe(true);
  });

  it("reads a broker-style file with commas and a per-share dividend", () => {
    const csv = ["Date,Ticker,Type,Quantity,Price,Fees", '05/01/2026,BAI,Buy,10,"61.000,50",120', "01/06/2026,BAI,Dividend,10,500,500", "02/06/2026,XYZ,Buy,1,10,0"].join("\n");
    const rows = parseCsv(csv, { securities, asOf, newID });
    expect(rows[0].transaction?.unitPrice.toFixed()).toBe("61000.5");
    expect(rows[0].transaction?.tradedOn).toBe("2026-01-05");
    expect(rows[1].transaction?.unitPrice.toFixed()).toBe("5000");
    expect(rows[1].transaction?.quantity.toFixed()).toBe("1");
    expect(rows[2]).toMatchObject({ line: 4, symbol: "XYZ", issue: "unknownSymbol" });
  });

  it("names each refused row", () => {
    const csv = [
      "data;simbolo;tipo;quantidade;preco",
      "2026-13-01;BAI;compra;1;10",
      "2026-01-01;BAI;troca;1;10",
      "2026-01-01;BAI;compra;1,5;10",
      "2026-01-01;BAI;compra;abc;10",
      "2027-01-01;BAI;compra;1;10",
      "2026-01-01;BAI;compra;1;10",
      "2026-01-01;BAI;compra;1;10",
    ].join("\r\n");
    expect(parseCsv(csv, { securities, asOf, newID }).map((row) => row.issue ?? "ok")).toEqual([
      "invalidDate",
      "invalidKind",
      "invalidRecord",
      "invalidNumber",
      "invalidRecord",
      "ok",
      "duplicate",
    ]);
    expect(parseCsv("simbolo;preco\nBAI;10", { securities, asOf, newID })[0].issue).toBe("missingColumns");
  });
});
