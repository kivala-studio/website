import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { exportPriceHistoryCSV, priceHistoryCSVFileName } from "./price-history-csv";
import { parseInstant } from "./zone";

// No iOS test exists; this pins the byte format the iOS export produces.
describe("price history CSV", () => {
  it("writes Luanda days oldest first with decimal commas, no grouping and CRLF", () => {
    const csv = exportPriceHistoryCSV([
      {
        date: parseInstant("2026-11-10T23:30:00Z")!,
        value: new Decimal("27700.123456789"),
        volume: new Decimal(1_250_000),
        tradeCount: 3,
      },
      {
        date: parseInstant("2026-11-09T12:00:00+01:00")!,
        value: new Decimal("98.5"),
        openValue: new Decimal(98),
        highValue: new Decimal("99.25"),
        lowValue: new Decimal("97.000000001"),
      },
    ]);
    expect(csv).toBe(
      "data;fecho;abertura;maximo;minimo;volume;negocios\r\n" +
        "2026-11-09;98,5;98;99,25;97;;\r\n" +
        "2026-11-11;27700,12345679;;;;1250000;3\r\n",
    );
    expect(priceHistoryCSVFileName("BFAAAAAA")).toBe("invest-ao-bfaaaaaa-historico.csv");
  });
});
