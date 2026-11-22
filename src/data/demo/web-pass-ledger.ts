import Decimal from "decimal.js";

import {
  type WebCheckoutInput,
  type WebOrder,
  type WebOrderResult,
  type WebOrderStatus,
  type WebPlan,
  angolanMobile,
  isWebPaymentMethod,
  webOrderNIF,
} from "@/domain/billing/web-pass";

import type { DemoTier } from "./tiers";

/*
 * Demo mode's web passes, without a backend: the orders an account opened and what they became, derived at
 * read time from the clock, as the backend's fake payment provider behaves. Express to a phone ending `0001`
 * pays 5 s after it opened, `0002` fails at once, any other phone expires with the order (10 min). A reference
 * pays after 20 s. Pure: the cookie lives in `./web-passes.ts`.
 */

/**
 * Clearly placeholder prices for demo mode only. Real prices only ever come from the server
 * (`get_web_plans()`); nothing outside demo mode may read these.
 */
export const DEMO_WEB_PLANS: readonly WebPlan[] = [
  { id: "plus_1m", months: 1, priceAOA: new Decimal("1111.11") },
  { id: "plus_12m", months: 12, priceAOA: new Decimal("11111.11") },
];

export const DEMO_WEB_PASS_TIMING = {
  expressWindowMs: 10 * 60_000,
  referenceWindowMs: 48 * 60 * 60_000,
  expressPaidAfterMs: 5_000,
  referencePaidAfterMs: 20_000,
  /** A `plus`/`pro` demo account's App Store subscription always renews 30 days from now. */
  storePeriodMs: 30 * 24 * 60 * 60_000,
  rateWindowMs: 60 * 60_000,
  rateLimit: 5,
} as const;

export const DEMO_REFERENCE = { entity: "00000", reference: "123456789" } as const;

/** What the provider will answer, decided when the order opens (as the fake encodes it in its ref). */
type Outcome = "paid" | "failed" | "expired";

export interface DemoWebOrder {
  readonly id: string;
  readonly productID: string;
  readonly months: number;
  /** Exact kwanzas, as a string. */
  readonly amount: string;
  readonly method: WebCheckoutInput["method"];
  readonly outcome: Outcome;
  /** Epoch milliseconds. */
  readonly createdAt: number;
  readonly expiresAt: number;
  /** When the provider starts answering `outcome`. */
  readonly readyAt: number;
  readonly cancelledAt: number | null;
}

/** At most this many orders stay in the cookie (about 4 KB), newest kept. */
export const DEMO_ORDER_LIMIT = 12;

const UUID = /^[0-9a-f-]{36}$/i;

/** The cookie's orders; anything malformed is dropped. */
export function decodeDemoOrders(value: string | undefined): DemoWebOrder[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): DemoWebOrder[] => {
      if (!Array.isArray(item)) return [];
      const [id, productID, months, amount, method, outcome, createdAt, expiresAt, readyAt, cancelledAt] = item as unknown[];
      const numbers = [months, createdAt, expiresAt, readyAt];
      if (typeof id !== "string" || !UUID.test(id) || typeof productID !== "string" || typeof amount !== "string" || !isWebPaymentMethod(method)) return [];
      if (outcome !== "paid" && outcome !== "failed" && outcome !== "expired") return [];
      if (!numbers.every((number) => typeof number === "number" && Number.isFinite(number))) return [];
      if (cancelledAt !== null && typeof cancelledAt !== "number") return [];
      return [
        {
          id,
          productID,
          months: months as number,
          amount,
          method,
          outcome,
          createdAt: createdAt as number,
          expiresAt: expiresAt as number,
          readyAt: readyAt as number,
          cancelledAt: cancelledAt as number | null,
        },
      ];
    });
  } catch {
    return [];
  }
}

export const encodeDemoOrders = (orders: readonly DemoWebOrder[]) =>
  JSON.stringify(
    orders
      .slice(0, DEMO_ORDER_LIMIT)
      .map((order) => [order.id, order.productID, order.months, order.amount, order.method, order.outcome, order.createdAt, order.expiresAt, order.readyAt, order.cancelledAt]),
  );

type State = { status: WebOrderStatus; paidAt: number | null };

function stateAt(order: DemoWebOrder, now: number): State {
  if (order.cancelledAt !== null) return { status: "cancelled", paidAt: null };
  if (now >= order.readyAt) return { status: order.outcome, paidAt: order.outcome === "paid" ? order.readyAt : null };
  if (now >= order.expiresAt) return { status: "expired", paidAt: null };
  return { status: "pending", paidAt: null };
}

const addMonths = (epoch: number, months: number) => {
  const date = new Date(epoch);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.getTime();
};

/**
 * Each paid order's pass, stacked in payment order: it starts at the latest of its payment, the end of the
 * previous pass and (for an App Store subscriber) the end of the running subscription.
 */
function passes(orders: readonly DemoWebOrder[], now: number, store: boolean): Map<string, { startsAt: number; endsAt: number }> {
  const paid = orders
    .map((order) => ({ order, paidAt: stateAt(order, now).paidAt }))
    .filter((item): item is { order: DemoWebOrder; paidAt: number } => item.paidAt !== null)
    .sort((a, b) => a.paidAt - b.paidAt || a.order.createdAt - b.order.createdAt);
  const result = new Map<string, { startsAt: number; endsAt: number }>();
  let cursor = 0;
  for (const { order, paidAt } of paid) {
    const startsAt = Math.max(paidAt, cursor, store ? paidAt + DEMO_WEB_PASS_TIMING.storePeriodMs : 0);
    cursor = addMonths(startsAt, order.months);
    result.set(order.id, { startsAt, endsAt: cursor });
  }
  return result;
}

const iso = (epoch: number) => new Date(epoch).toISOString();

/** Every order as the server would answer it at `now`, newest first. */
export function demoWebOrders(orders: readonly DemoWebOrder[], now: number, store: boolean): WebOrder[] {
  const passed = passes(orders, now, store);
  return [...orders]
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
    .map((order) => {
      const { status, paidAt } = stateAt(order, now);
      const pass = passed.get(order.id);
      return {
        id: order.id,
        productID: order.productID,
        months: order.months,
        amountAOA: new Decimal(order.amount),
        method: order.method,
        status,
        reference: order.method === "reference" ? { ...DEMO_REFERENCE } : null,
        expiresAt: iso(order.expiresAt),
        paidAt: paidAt === null ? null : iso(paidAt),
        createdAt: iso(order.createdAt),
        pass: pass ? { startsAt: iso(pass.startsAt), endsAt: iso(pass.endsAt) } : null,
      };
    });
}

export const demoWebOrder = (orders: readonly DemoWebOrder[], id: string, now: number, store: boolean) =>
  demoWebOrders(orders, now, store).find((order) => order.id === id.toLowerCase()) ?? null;

/** The plan part of the access document: a `plus`/`pro` login stands for an App Store subscription. */
export function demoWebPassAccess(login: DemoTier, orders: readonly DemoWebOrder[], now: number): { isPlus: boolean; plusUntil: string | null; storeSubscription: boolean } {
  const store = login !== "free";
  const ends = [...passes(orders, now, store).values()];
  const running = ends.some((pass) => pass.startsAt <= now && now < pass.endsAt);
  const lastEnd = Math.max(0, ...ends.map((pass) => pass.endsAt));
  if (store) return { isPlus: true, plusUntil: iso(Math.max(now + DEMO_WEB_PASS_TIMING.storePeriodMs, lastEnd)), storeSubscription: true };
  return { isPlus: running, plusUntil: running ? iso(lastEnd) : null, storeSubscription: false };
}

export type DemoCheckout = { readonly orders: DemoWebOrder[]; readonly result: WebOrderResult };

/** `web-checkout` against the demo ledger: the server's checks in its order, then a pending order. */
export function demoCheckout(
  orders: readonly DemoWebOrder[],
  input: WebCheckoutInput,
  context: { now: number; id: string; login: DemoTier; plans: readonly WebPlan[] },
): DemoCheckout {
  const { now, id, login, plans } = context;
  const refuse = (result: WebOrderResult): DemoCheckout => ({ orders: [...orders], result });
  const phone = input.method === "mcx_express" ? angolanMobile(input.phone) : null;
  if (input.method === "mcx_express" && !phone) return refuse({ failure: "invalidPhone" });
  if (plans.length === 0) return refuse({ failure: "closed" });
  const plan = plans.find((item) => item.id === input.productID);
  if (!plan) return refuse({ failure: "productUnavailable" });
  if (webOrderNIF(input.nif) === false) return refuse({ failure: "invalidNIF" });
  const views = demoWebOrders(orders, now, login !== "free");
  const pending = views.find((order) => order.status === "pending");
  if (pending) return refuse({ failure: "pending", orderID: pending.id });
  if (orders.filter((order) => order.createdAt > now - DEMO_WEB_PASS_TIMING.rateWindowMs).length >= DEMO_WEB_PASS_TIMING.rateLimit) {
    return refuse({ failure: "rateLimited" });
  }

  const T = DEMO_WEB_PASS_TIMING;
  const expiresAt = now + (phone ? T.expressWindowMs : T.referenceWindowMs);
  const [outcome, readyAt]: [Outcome, number] = !phone
    ? ["paid", now + T.referencePaidAfterMs]
    : phone.endsWith("0001")
      ? ["paid", now + T.expressPaidAfterMs]
      : phone.endsWith("0002")
        ? ["failed", now]
        : ["expired", expiresAt];
  const order: DemoWebOrder = {
    id: id.toLowerCase(),
    productID: plan.id,
    months: plan.months,
    amount: plan.priceAOA.toFixed(),
    method: input.method,
    outcome,
    createdAt: now,
    expiresAt,
    readyAt,
    cancelledAt: null,
  };
  const next = [order, ...orders].slice(0, DEMO_ORDER_LIMIT);
  // Checkout answers the order as opened; the provider's answer shows from the next read on, as on the server.
  const [opened] = demoWebOrders([order], now, false);
  return { orders: next, result: { order: { ...opened, status: "pending", paidAt: null, pass: null } } };
}

/** `cancel_web_order`: a pending order becomes `cancelled`; any other order comes back unchanged. */
export function demoCancel(orders: readonly DemoWebOrder[], id: string, now: number, login: DemoTier): { orders: DemoWebOrder[]; order: WebOrder | null } {
  const store = login !== "free";
  const current = demoWebOrder(orders, id, now, store);
  if (!current || current.status !== "pending") return { orders: [...orders], order: current };
  const next = orders.map((order) => (order.id === current.id ? { ...order, cancelledAt: now } : order));
  return { orders: next, order: demoWebOrder(next, id, now, store) };
}
