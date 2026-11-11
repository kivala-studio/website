import { describe, expect, it } from "vitest";

import { availableOrderCount, decodeOrderBookRows } from "./order-book";

const decodeLevel = (level: string) =>
  decodeOrderBookRows(JSON.parse(`[{"security_id":"s","order_book_levels":[${level}]}]`))[0].levels[0];

// OrderBookLevelTests, against the contract's snake_case row (the website keeps no level cache).
describe("order book level", () => {
  it("missing and null counts remain unknown", () => {
    for (const countField of ["", ',"order_count":null']) {
      const level = decodeLevel(`{"side":"bid","level":4,"price":90000,"quantity":65${countField}}`);
      expect(level.orderCount).toBeUndefined();
      expect(availableOrderCount(level)).toBeUndefined();
      expect(level.quantity.toNumber()).toBe(65);
    }
  });

  it("legacy zero counts stay hidden and known counts remain available", () => {
    for (const count of [0, 1, 7]) {
      const level = decodeLevel(`{"side":"ask","level":5,"price":97000,"quantity":13,"order_count":${count}}`);
      expect(level.orderCount).toBe(count);
      expect(availableOrderCount(level)).toBe(count > 0 ? count : undefined);
    }
  });
});
