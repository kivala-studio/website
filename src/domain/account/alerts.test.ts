import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { ALERT_KINDS, acceptsThreshold, decodeAlertRule, defaultThreshold, hasThreshold, isValidThreshold, priceDistance, priceShortcut } from "./alerts";

const d = (value: string) => new Decimal(value);

describe("alert rule thresholds (contract §4.3)", () => {
  it("covers the server's eight kinds", () => {
    expect(ALERT_KINDS).toHaveLength(8);
    expect(ALERT_KINDS.filter((kind) => !hasThreshold(kind))).toEqual(["high_52w", "low_52w"]);
  });

  it("matches numeric(24,8)", () => {
    expect(isValidThreshold(d("0.00000001"))).toBe(true);
    expect(isValidThreshold(d("0.000000001"))).toBe(false);
    expect(isValidThreshold(d("0"))).toBe(false);
    expect(isValidThreshold(d("1e16"))).toBe(false);
  });

  it("applies each kind's range", () => {
    expect(acceptsThreshold("high_52w", d("1"))).toBe(true);
    expect(acceptsThreshold("low_52w", d("2"))).toBe(false);
    expect(acceptsThreshold("volume_above_average", d("1.5"))).toBe(true);
    expect(acceptsThreshold("volume_above_average", d("1.4"))).toBe(false);
    expect(acceptsThreshold("volume_above_average", d("20"))).toBe(true);
    expect(acceptsThreshold("volume_above_average", d("20.01"))).toBe(false);
    expect(acceptsThreshold("days_without_trades", d("365"))).toBe(true);
    expect(acceptsThreshold("days_without_trades", d("366"))).toBe(false);
    expect(acceptsThreshold("days_without_trades", d("2.5"))).toBe(false);
    expect(acceptsThreshold("percent_change_below", d("-3"))).toBe(true);
    expect(acceptsThreshold("percent_change_below", d("3"))).toBe(false);
    expect(acceptsThreshold("price_above", d("-3"))).toBe(false);
  });

  it("pre-fills the defaulted kinds", () => {
    expect(defaultThreshold("volume_above_average")?.toString()).toBe("2");
    expect(defaultThreshold("days_without_trades")?.toString()).toBe("7");
    expect(defaultThreshold("price_above")).toBeUndefined();
  });

  it("decodes rows and skips unknown kinds", () => {
    const rule = decodeAlertRule({ id: "r", security_id: "s", kind: "price_above", threshold: 120.5, is_enabled: false, created_at: "2026-11-10T10:00:00Z" });
    expect(rule?.threshold.toString()).toBe("120.5");
    expect(rule?.isEnabled).toBe(false);
    expect(decodeAlertRule({ id: "r", security_id: "s", kind: "price_far", threshold: 1, is_enabled: true })).toBeNull();
  });

  it("states the distance from the current price and the ±% shortcuts", () => {
    expect(priceDistance(d("110"), d("100"))).toEqual({ direction: "above", percent: d("10") });
    expect(priceDistance(d("100.04"), d("100"))?.direction).toBe("equal");
    expect(priceShortcut(d("96500"), -5)).toEqual({ kind: "price_below", threshold: d("91675") });
    expect(priceShortcut(d("19001"), 10).threshold.toString()).toBe("20901.1");
  });
});
