import { describe, expect, it } from "vitest";

import type { WebCheckoutInput } from "@/domain/billing/web-pass";

import type { DemoTier } from "./tiers";
import { DEMO_WEB_PLANS, type DemoWebOrder, decodeDemoOrders, demoCancel, demoCheckout, demoWebOrder, demoWebPassAccess, encodeDemoOrders } from "./web-pass-ledger";

const T0 = Date.parse("2026-11-22T10:00:00Z");
const ID = (n: number) => `d5e30000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const express = (phone: string): WebCheckoutInput => ({ productID: "plus_1m", method: "mcx_express", phone });

function open(input: WebCheckoutInput, orders: DemoWebOrder[] = [], now = T0, n = 1, login: DemoTier = "free") {
  const checkout = demoCheckout(orders, input, { now, id: ID(n), login, plans: DEMO_WEB_PLANS });
  // Every step goes through the cookie encoding, as the endpoints do.
  return { ...checkout, orders: decodeDemoOrders(encodeDemoOrders(checkout.orders)) };
}

const statusAt = (orders: DemoWebOrder[], now: number, login: DemoTier = "free") => demoWebOrder(orders, orders[0].id, now, login !== "free")!;

describe("demo web pass orders", () => {
  it("Express to …0001 opens pending, then pays at +5 s and the Free account becomes Plus", () => {
    const { orders, result } = open(express("+244 923-000-001"));
    expect(result).toMatchObject({ order: { status: "pending", method: "mcx_express", reference: null, pass: null } });
    expect(statusAt(orders, T0 + 4_999).status).toBe("pending");
    expect(demoWebPassAccess("free", orders, T0 + 4_999)).toEqual({ isPlus: false, plusUntil: null, storeSubscription: false });

    const paid = statusAt(orders, T0 + 5_000);
    expect(paid).toMatchObject({ status: "paid", paidAt: "2026-11-22T10:00:05.000Z", pass: { startsAt: "2026-11-22T10:00:05.000Z", endsAt: "2026-12-22T10:00:05.000Z" } });
    expect(paid.amountAOA.toFixed()).toBe(DEMO_WEB_PLANS[0].priceAOA.toFixed());
    expect(demoWebPassAccess("free", orders, T0 + 5_000)).toEqual({ isPlus: true, plusUntil: "2026-12-22T10:00:05.000Z", storeSubscription: false });
    expect(demoWebPassAccess("free", orders, Date.parse("2026-12-23T00:00:00Z")).isPlus).toBe(false);
  });

  it("…0002 fails, any other phone expires with the order, a reference pays at +20 s", () => {
    const failed = open(express("923000002"));
    expect(failed.result).toMatchObject({ order: { status: "pending" } });
    expect(statusAt(failed.orders, T0 + 1).status).toBe("failed");

    const lapsing = open(express("923123456")).orders;
    expect(statusAt(lapsing, T0 + 10 * 60_000 - 1).status).toBe("pending");
    expect(statusAt(lapsing, T0 + 10 * 60_000).status).toBe("expired");
    expect(demoWebPassAccess("free", lapsing, T0 + 10 * 60_000).isPlus).toBe(false);

    const reference = open({ productID: "plus_12m", method: "reference" });
    expect(reference.result).toMatchObject({ order: { status: "pending", reference: { entity: "00000", reference: "123456789" } } });
    expect(statusAt(reference.orders, T0 + 19_999).status).toBe("pending");
    expect(statusAt(reference.orders, T0 + 20_000).pass).toEqual({ startsAt: "2026-11-22T10:00:20.000Z", endsAt: "2027-11-22T10:00:20.000Z" });
  });

  it("refuses a second order while one is pending, naming it, and allows one after", () => {
    const first = open(express("923123456")).orders;
    expect(open(express("923000001"), first, T0 + 1_000, 2).result).toEqual({ failure: "pending", orderID: ID(1) });
    expect(open(express("923000001"), first, T0 + 10 * 60_000, 2).result).toMatchObject({ order: { id: ID(2) } });
  });

  it("checks the phone, the product, the NIF and closed plans", () => {
    expect(open(express("912")).result).toEqual({ failure: "invalidPhone" });
    expect(open({ productID: "plus_6m", method: "reference" }).result).toEqual({ failure: "productUnavailable" });
    expect(open({ productID: "plus_1m", method: "reference", nif: "12-34" }).result).toEqual({ failure: "invalidNIF" });
    expect(open({ productID: "plus_1m", method: "reference", nif: "  " }).result).toMatchObject({ order: { status: "pending" } });
    expect(demoCheckout([], { productID: "plus_1m", method: "reference" }, { now: T0, id: ID(1), login: "free", plans: [] }).result).toEqual({ failure: "closed" });
  });

  it("cancels a pending order only, and a cancelled order never pays", () => {
    const { orders } = open(express("923000001"));
    const cancelled = demoCancel(orders, ID(1), T0 + 1_000, "free");
    expect(cancelled.order?.status).toBe("cancelled");
    expect(statusAt(cancelled.orders, T0 + 60_000).status).toBe("cancelled");
    expect(demoWebPassAccess("free", cancelled.orders, T0 + 60_000).isPlus).toBe(false);
    expect(demoCancel(orders, ID(1), T0 + 6_000, "free").order?.status).toBe("paid");
    expect(demoCancel(orders, ID(9), T0, "free").order).toBeNull();
  });

  it("an App Store subscriber's pass starts after the subscription (now + 30 days)", () => {
    const { orders } = open(express("923000001"), [], T0, 1, "plus");
    expect(demoWebPassAccess("plus", [], T0)).toEqual({ isPlus: true, plusUntil: "2026-12-22T10:00:00.000Z", storeSubscription: true });
    expect(statusAt(orders, T0 + 5_000, "plus").pass).toEqual({ startsAt: "2026-12-22T10:00:05.000Z", endsAt: "2027-01-22T10:00:05.000Z" });
    expect(demoWebPassAccess("plus", orders, T0 + 5_000).plusUntil).toBe("2027-01-22T10:00:05.000Z");
  });
});
