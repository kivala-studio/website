import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { calculateBondYield, couponDates } from "./bond-yield";

// BondYieldTests
describe("bond yield", () => {
  it("a par bond on a coupon date yields its coupon", () => {
    const result = calculateBondYield({
      cleanPrice: new Decimal(100),
      terms: { couponRate: new Decimal(16), frequency: 2 },
      maturity: "2030-06-15",
      settlement: "2026-06-15",
    });
    expect(result).toBeDefined();
    expect(result!.yieldToMaturity.minus(16).abs().lt("0.0001")).toBe(true);
    expect(result!.accruedInterest.isZero()).toBe(true);
    expect(result!.remainingCoupons).toBe(8);
  });

  it("a discount raises the yield and accrues halfway interest", () => {
    const result = calculateBondYield({
      cleanPrice: new Decimal(95),
      terms: { couponRate: new Decimal(10), frequency: 1 },
      maturity: "2028-01-01",
      settlement: "2026-07-02",
    });
    expect(result).toBeDefined();
    expect(result!.yieldToMaturity.gt(10)).toBe(true);
    expect(result!.accruedInterest.minus(5).abs().lt("0.05")).toBe(true);
    expect(result!.nextCouponDate).toBe("2027-01-01");
  });

  it("the schedule ends on maturity", () => {
    const dates = couponDates("2027-03-31", 4, "2026-06-01", "2027-12-31");
    expect(dates).toHaveLength(4);
    expect(dates.at(-1)).toBe("2027-03-31");
  });
});
