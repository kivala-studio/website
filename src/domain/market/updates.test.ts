import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { marketSecurity } from "./models";
import { type MarketUpdate, type MarketUpdateCategory, marketUpdates, relatedSecurities } from "./updates";

// Ports MarketInformationTests.swift case for case.
const NOW = Date.UTC(2026, 9, 6);

const makeSecurity = (id: string) =>
  marketSecurity({ id, symbol: id, name: `Título ${id}`, issuer: `Emitente ${id}`, kind: "equity", price: new Decimal(100) });

const makeUpdate = (id: string, category: MarketUpdateCategory, timestamp: number, relatedSecurityIDs: string[]): MarketUpdate => ({
  id,
  category,
  title: id,
  detail: id,
  timestamp,
  source: "BODIVA",
  relatedSecurityIDs,
  body: [id],
});

const securities = [makeSecurity("AAA"), makeSecurity("BBB")];
const updates = [
  makeUpdate("old-bodiva", "bodiva", 100_000, ["BBB", "AAA", "CCC"]),
  makeUpdate("new-bodiva", "bodiva", 200_000, []),
  makeUpdate("issuer", "issuers", 300_000, ["AAA"]),
];

describe("market information", () => {
  it("market updates filter by category and sort newest first", () => {
    expect(marketUpdates(updates, "bodiva").map((update) => update.id)).toEqual(["new-bodiva", "old-bodiva"]);
    expect(marketUpdates(updates).map((update) => update.id)).toEqual(["issuer", "new-bodiva", "old-bodiva"]);
  });

  it("related securities follow article order and ignore missing ids", () => {
    expect(relatedSecurities(updates[0], securities, NOW).map((security) => security.id)).toEqual(["BBB", "AAA"]);
  });
});
