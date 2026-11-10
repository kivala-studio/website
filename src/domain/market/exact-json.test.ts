import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { decodeCurrentMarketQuotes } from "./decode";
import { parseExactJson } from "./exact-json";

describe("exact JSON", () => {
  it("numeric(24,8) prices keep every digit from the response text to Decimal", () => {
    const text =
      '{"prices":[{"security_id":"S\\"1","last_price":1234567890123456.12345678,"close_price":-0.00000001,"volume":30000}],"sessions":[],"overview":[]}';
    expect(new Decimal(JSON.parse(text).prices[0].last_price).toFixed(8)).not.toBe("1234567890123456.12345678");
    const quotes = decodeCurrentMarketQuotes(parseExactJson(text));
    const row = quotes.prices[0];
    expect(row.securityID).toBe('S"1');
    expect(row.lastPrice?.toFixed(8)).toBe("1234567890123456.12345678");
    expect(row.closePrice?.toFixed(8)).toBe("-0.00000001");
    expect(row.volume?.toString()).toBe("30000");
  });
});
