import { describe, expect, it } from "vitest";

import {
  WEB_CHECKOUT_FAILURE_STATUS,
  annualSaving,
  decodeWebCheckoutInput,
  decodeWebOrder,
  decodeWebOrders,
  decodeWebPlan,
  decodeWebPlans,
  encodeWebOrder,
  encodeWebPlan,
  webCheckoutFailure,
  webOrderDate,
  webOrderHistory,
  webOrderPollDelay,
  withWebOrder,
} from "./web-pass";

const ORDER = {
  id: "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60",
  product_id: "plus_12m",
  months: 12,
  amount_aoa: 50000,
  method: "reference",
  status: "paid",
  reference: { entity: "00000", reference: "123456789" },
  expires_at: "2026-11-24T10:00:00+00:00",
  paid_at: "2026-11-22T10:00:20+00:00",
  created_at: "2026-11-22T10:00:00+00:00",
  pass: { starts_at: "2026-11-22T10:00:20+00:00", ends_at: "2027-11-22T10:00:20+00:00" },
};

describe("web pass decoders (contract §7.5)", () => {
  it("reads a server order and survives the route's JSON round trip", () => {
    const order = decodeWebOrder(ORDER)!;
    expect(order).toMatchObject({ productID: "plus_12m", months: 12, method: "reference", status: "paid", pass: { endsAt: "2027-11-22T10:00:20+00:00" } });
    expect(order.amountAOA.toFixed()).toBe("50000");
    const json = JSON.parse(JSON.stringify(encodeWebOrder(order)));
    expect(json.amountAOA).toBe("50000");
    expect(decodeWebOrder(json)).toEqual(order);
  });

  it("rejects a row with an unknown status or method instead of failing the list", () => {
    expect(decodeWebOrder({ ...ORDER, status: "chargeback" })).toBeNull();
    expect(decodeWebOrder({ ...ORDER, method: "card" })).toBeNull();
    expect(decodeWebOrders([ORDER, { ...ORDER, status: "chargeback" }, null])).toHaveLength(1);
    expect(decodeWebOrders({})).toBeNull();
  });

  it("keeps numeric(14,2) prices exact", () => {
    for (const [wire, exact] of [
      [5000, "5000"],
      [4999.5, "4999.5"],
      [0.1, "0.1"],
      ["123456789012.34", "123456789012.34"],
    ] as const) {
      const plan = decodeWebPlan({ id: "plus_1m", months: 1, price_aoa: wire })!;
      expect(plan.priceAOA.toFixed()).toBe(exact);
      expect(decodeWebPlan(encodeWebPlan(plan))!.priceAOA.toFixed()).toBe(exact);
    }
    expect(decodeWebPlans([{ id: "plus_1m", months: 1, price_aoa: 0 }, { id: "plus_1m", months: 1, price_aoa: "1e3" }])).toEqual([]);
  });
});

describe("annual saving", () => {
  const plans = (month: number | string, year: number | string) => decodeWebPlans([
    { id: "plus_1m", months: 1, price_aoa: month },
    { id: "plus_12m", months: 12, price_aoa: year },
  ])!;

  it("compares the year with twelve months in Decimal", () => {
    const saving = annualSaving(plans(5000, 50000))!;
    expect(saving.saving.toFixed()).toBe("10000");
    expect(saving.monthly.toFixed(2)).toBe("4166.67");
    expect(saving.percent.toFixed()).toBe("16");
    expect(annualSaving(plans("0.1", "1.1"))!.saving.toFixed()).toBe("0.1");
  });

  it("is null without both plans or without a saving", () => {
    expect(annualSaving(plans(5000, 60000))).toBeNull();
    expect(annualSaving(plans(5000, 50000).slice(0, 1))).toBeNull();
  });
});

describe("checkout failures", () => {
  it("maps every Edge Function code", () => {
    const codes: [number, string, string][] = [
      [400, "INVALID_JSON", "invalidInput"],
      [400, "INVALID_INPUT", "invalidInput"],
      [400, "INVALID_PHONE", "invalidPhone"],
      [400, "WEB_ORDER_NIF_INVALID", "invalidNIF"],
      [401, "UNAUTHENTICATED", "signedOut"],
      [403, "WEB_PASSES_CLOSED", "closed"],
      [404, "WEB_ORDER_NOT_FOUND", "notFound"],
      [409, "WEB_PRODUCT_UNAVAILABLE", "productUnavailable"],
      [409, "WEB_PASS_NOT_NEEDED", "notNeeded"],
      [409, "WEB_ORDER_PENDING", "pending"],
      [429, "WEB_ORDER_RATE_LIMIT", "rateLimited"],
      [502, "PAYMENT_GATEWAY_UNAVAILABLE", "gatewayUnavailable"],
      [503, "PAYMENTS_NOT_CONFIGURED", "notConfigured"],
    ];
    for (const [status, code, failure] of codes) {
      expect(webCheckoutFailure(status, code)).toBe(failure);
      expect(WEB_CHECKOUT_FAILURE_STATUS[webCheckoutFailure(status, code)]).toBe(status);
    }
    expect(webCheckoutFailure(500, "INTERNAL_ERROR")).toBe("unavailable");
    expect(webCheckoutFailure(429, undefined)).toBe("rateLimited");
    expect(webCheckoutFailure(null, "toString")).toBe("unavailable");
  });

  it("accepts only a well-formed checkout body", () => {
    expect(decodeWebCheckoutInput({ productID: "plus_1m", method: "mcx_express", phone: "923 000 001" })).toEqual({ productID: "plus_1m", method: "mcx_express", phone: "923 000 001" });
    expect(decodeWebCheckoutInput({ productID: "plus_1m", method: "reference", phone: "923000001", nif: null })).toEqual({ productID: "plus_1m", method: "reference" });
    expect(decodeWebCheckoutInput({ productID: "Plus 1m", method: "reference" })).toBeNull();
    expect(decodeWebCheckoutInput({ productID: "plus_1m", method: "card" })).toBeNull();
    expect(decodeWebCheckoutInput({ productID: "plus_1m", method: "reference", nif: 123 })).toBeNull();
  });
});

describe("webOrderPollDelay", () => {
  const opened = Date.parse("2026-11-22T10:00:00Z");
  const order = (method: "mcx_express" | "reference", status: "pending" | "paid" = "pending") => ({
    method,
    status,
    createdAt: "2026-11-22T10:00:00Z",
    expiresAt: method === "reference" ? "2026-11-24T10:00:00Z" : "2026-11-22T10:10:00Z",
  });

  it("polls every 3 s, a reference order once a minute after its first 10 minutes", () => {
    expect(webOrderPollDelay(order("mcx_express"), opened + 1_000)).toBe(3_000);
    expect(webOrderPollDelay(order("reference"), opened + 9 * 60_000)).toBe(3_000);
    expect(webOrderPollDelay(order("reference"), opened + 10 * 60_000)).toBe(60_000);
  });

  it("never waits past expiry and stops once the order is settled or expired", () => {
    expect(webOrderPollDelay(order("mcx_express"), opened + 10 * 60_000 - 1_000)).toBe(1_000);
    expect(webOrderPollDelay(order("mcx_express"), opened + 10 * 60_000)).toBeNull();
    expect(webOrderPollDelay(order("mcx_express", "paid"), opened)).toBeNull();
  });
});

describe("order history", () => {
  const paid = decodeWebOrder(ORDER)!;
  const at = (id: string, status: string, created: string) => decodeWebOrder({ ...ORDER, id, status, created_at: created, paid_at: null, pass: null })!;

  it("lists every order but the pending one, newest first, at most ten", () => {
    const orders = [at("p", "pending", "2026-11-23T00:00:00Z"), paid, ...Array.from({ length: 12 }, (_, index) => at(`o${index}`, "expired", "2026-11-01T00:00:00Z"))];
    const history = webOrderHistory(orders);
    expect(history).toHaveLength(10);
    expect(history[0]).toBe(paid);
    expect(history.map((order) => order.id)).not.toContain("p");
  });

  it("takes an order's new state in place, and a new order first", () => {
    const pending = at("p", "pending", "2026-11-23T00:00:00Z");
    const settled = { ...pending, status: "failed" as const };
    expect(withWebOrder([pending, paid], settled)).toEqual([settled, paid]);
    expect(withWebOrder([paid], pending)).toEqual([pending, paid]);
  });

  it("dates a paid order by its payment, any other by its creation", () => {
    expect(webOrderDate(paid)).toBe(paid.paidAt);
    expect(webOrderDate({ ...paid, status: "refunded" })).toBe(paid.createdAt);
  });
});
