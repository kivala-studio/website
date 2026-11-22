import Decimal from "decimal.js";

/*
 * Plus web passes (contract §7.5): prepaid Plus for 1 or 12 months, paid in kwanzas with Multicaixa, never
 * renewed. Plus is the only paid plan. Prices only ever come from the server (`get_web_plans()`); money stays
 * `Decimal` end to end and crosses route JSON as exact strings. Dates stay as the server sent them.
 */

export const WEB_PAYMENT_METHODS = ["mcx_express", "reference"] as const;
export type WebPaymentMethod = (typeof WEB_PAYMENT_METHODS)[number];

export const WEB_ORDER_STATUSES = ["pending", "paid", "expired", "failed", "refunded", "cancelled"] as const;
export type WebOrderStatus = (typeof WEB_ORDER_STATUSES)[number];

/** How often the browser asks for a pending order's live status (backend: about every 3 s). */
export const WEB_ORDER_POLL_MS = 3_000;

export interface WebPlan {
  /** Catalogue id (`plus_1m`, `plus_12m`); sent back as `productID` at checkout. */
  readonly id: string;
  readonly months: number;
  readonly priceAOA: Decimal;
}

/** Multicaixa pay-by-reference details. */
export interface WebPaymentReference {
  readonly entity: string;
  readonly reference: string;
}

/** The Plus time a paid order bought; it may start later than the payment (it queues after paid time). */
export interface WebPass {
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface WebOrder {
  readonly id: string;
  readonly productID: string;
  readonly months: number;
  readonly amountAOA: Decimal;
  readonly method: WebPaymentMethod;
  readonly status: WebOrderStatus;
  /** Only for `reference` orders. */
  readonly reference: WebPaymentReference | null;
  readonly expiresAt: string;
  readonly paidAt: string | null;
  readonly createdAt: string;
  readonly pass: WebPass | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);
const pick = (row: Record<string, unknown>, snake: string, camel: string) => (snake in row ? row[snake] : row[camel]);

export const isWebPaymentMethod = (value: unknown): value is WebPaymentMethod =>
  typeof value === "string" && (WEB_PAYMENT_METHODS as readonly string[]).includes(value);
export const isWebOrderStatus = (value: unknown): value is WebOrderStatus => typeof value === "string" && (WEB_ORDER_STATUSES as readonly string[]).includes(value);

/** A positive kwanza amount: a JSON number (numeric(14,2) as PostgREST sends it) or an exact string. */
function money(value: unknown): Decimal | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+(\.\d+)?$/.test(value)) return null;
  try {
    const decimal = new Decimal(value);
    return decimal.isFinite() && decimal.gt(0) ? decimal : null;
  } catch {
    return null;
  }
}

const months = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null);

/** One `get_web_plans()` row (or the route's JSON of one); null when it is not a plan this client knows. */
export function decodeWebPlan(row: unknown): WebPlan | null {
  if (!isRecord(row)) return null;
  const id = text(row.id);
  const length = months(row.months);
  const price = money(pick(row, "price_aoa", "priceAOA"));
  return id && length && price ? { id, months: length, priceAOA: price } : null;
}

function decodePass(value: unknown): WebPass | null {
  if (!isRecord(value)) return null;
  const startsAt = text(pick(value, "starts_at", "startsAt"));
  const endsAt = text(pick(value, "ends_at", "endsAt"));
  return startsAt && endsAt ? { startsAt, endsAt } : null;
}

function decodeReference(value: unknown): WebPaymentReference | null {
  if (!isRecord(value)) return null;
  const entity = text(value.entity);
  const reference = text(value.reference);
  return entity && reference ? { entity, reference } : null;
}

/** One order (RPC or Edge Function body, or the route's JSON of one); null for an unknown status or method. */
export function decodeWebOrder(row: unknown): WebOrder | null {
  if (!isRecord(row)) return null;
  const id = text(row.id);
  const productID = text(pick(row, "product_id", "productID"));
  const length = months(row.months);
  const amount = money(pick(row, "amount_aoa", "amountAOA"));
  const method = row.method;
  const status = row.status;
  const expiresAt = text(pick(row, "expires_at", "expiresAt"));
  const createdAt = text(pick(row, "created_at", "createdAt"));
  if (!id || !productID || !length || !amount || !isWebPaymentMethod(method) || !isWebOrderStatus(status) || !expiresAt || !createdAt) return null;
  return {
    id,
    productID,
    months: length,
    amountAOA: amount,
    method,
    status,
    reference: decodeReference(row.reference),
    expiresAt,
    paidAt: text(pick(row, "paid_at", "paidAt")),
    createdAt,
    pass: decodePass(row.pass),
  };
}

const rows = <T>(body: unknown, decode: (row: unknown) => T | null): T[] | null =>
  Array.isArray(body) ? body.map(decode).filter((item): item is T => item !== null) : null;

/** A list body: rows this client does not know are dropped; null when the body is not a list. */
export const decodeWebPlans = (body: unknown) => rows(body, decodeWebPlan);
export const decodeWebOrders = (body: unknown) => rows(body, decodeWebOrder);

/** Route JSON: money as exact strings, camel case. `decodeWebPlan` / `decodeWebOrder` read it back. */
export const encodeWebPlan = (plan: WebPlan) => ({ id: plan.id, months: plan.months, priceAOA: plan.priceAOA.toFixed() });

export const encodeWebOrder = (order: WebOrder) => ({ ...order, amountAOA: order.amountAOA.toFixed() });

export type WebPlanJSON = ReturnType<typeof encodeWebPlan>;
export type WebOrderJSON = ReturnType<typeof encodeWebOrder>;

/** The order still waits for a payment: poll its status every `WEB_ORDER_POLL_MS`. */
export const isPendingWebOrder = (order: Pick<WebOrder, "status">) => order.status === "pending";

/** `/planos` lists at most this many past orders. */
export const WEB_ORDER_HISTORY_LIMIT = 10;

/** An order that left `pending`: how it ended is final. */
export type SettledWebOrder = WebOrder & { readonly status: Exclude<WebOrderStatus, "pending"> };

/** Past orders for `/planos`: every order but a pending one (the page shows that one), newest first. */
export const webOrderHistory = (orders: readonly WebOrder[], limit = WEB_ORDER_HISTORY_LIMIT) =>
  orders.filter((order): order is SettledWebOrder => !isPendingWebOrder(order)).slice(0, limit);

/** The orders with `order`'s latest state: replaced in place, or first when it is new. */
export const withWebOrder = (orders: readonly WebOrder[], order: WebOrder): WebOrder[] =>
  orders.some((item) => item.id === order.id) ? orders.map((item) => (item.id === order.id ? order : item)) : [order, ...orders];

/** The instant a history row is dated by: when a paid order was paid, otherwise when it was opened. */
export const webOrderDate = (order: Pick<WebOrder, "status" | "paidAt" | "createdAt">) => (order.status === "paid" && order.paidAt ? order.paidAt : order.createdAt);

/** A reference order is paid away from the site (an ATM, online banking): after its first minutes, once a minute is enough. */
export const WEB_ORDER_SLOW_POLL_MS = 60_000;
export const WEB_ORDER_SLOW_AFTER_MS = 10 * 60_000;

/**
 * How long to wait before reading a pending order's live status again: `WEB_ORDER_POLL_MS`, or once a minute for a
 * reference order older than ten minutes, never past `expiresAt`. Null once the order left `pending` or its time is
 * up: the caller then reads it one last time and stops.
 */
export function webOrderPollDelay(order: Pick<WebOrder, "status" | "method" | "createdAt" | "expiresAt">, now: number): number | null {
  if (!isPendingWebOrder(order)) return null;
  const remaining = Date.parse(order.expiresAt) - now;
  if (!(remaining > 0)) return null;
  const slow = order.method === "reference" && now - Date.parse(order.createdAt) >= WEB_ORDER_SLOW_AFTER_MS;
  return Math.min(slow ? WEB_ORDER_SLOW_POLL_MS : WEB_ORDER_POLL_MS, remaining);
}

/**
 * The 12-month plan against twelve 1-month plans, for a savings pill: null unless both exist and the year is
 * cheaper. `percent` is rounded down so the pill never overstates the saving.
 */
export function annualSaving(plans: readonly WebPlan[]): { monthly: Decimal; saving: Decimal; percent: Decimal } | null {
  const month = plans.find((plan) => plan.months === 1);
  const year = plans.find((plan) => plan.months === 12);
  if (!month || !year) return null;
  const twelve = month.priceAOA.times(12);
  const saving = twelve.minus(year.priceAOA);
  if (!saving.gt(0)) return null;
  return {
    monthly: year.priceAOA.div(12),
    saving,
    percent: saving.times(100).div(twelve).toDecimalPlaces(0, Decimal.ROUND_DOWN),
  };
}

/** The mobile number Multicaixa Express pushes to (`9XXXXXXXX`), as the server reads it; null when it is not one. */
export function angolanMobile(input: unknown): string | null {
  if (typeof input !== "string") return null;
  return input.replace(/[\s-]/g, "").match(/^(?:\+244|00244|244)?(9\d{8})$/)?.[1] ?? null;
}

/** The optional NIF as the server reads it: trimmed, empty means none; `false` when the server refuses it. */
export function webOrderNIF(input: unknown): string | null | false {
  if (input === undefined || input === null) return null;
  if (typeof input !== "string") return false;
  const nif = input.trim();
  if (nif === "") return null;
  return /^[A-Za-z0-9]{6,20}$/.test(nif) ? nif : false;
}

// MARK: Checkout failures

/**
 * Why a checkout, status read or cancel did not answer an order. Every Edge Function code maps to one;
 * `unavailable` covers transport failures and anything unknown.
 */
export const WEB_CHECKOUT_FAILURES = [
  "invalidInput",
  "invalidPhone",
  "invalidNIF",
  "signedOut",
  "closed",
  "productUnavailable",
  "notNeeded",
  "pending",
  "rateLimited",
  "gatewayUnavailable",
  "notConfigured",
  "notFound",
  "unavailable",
] as const;
export type WebCheckoutFailure = (typeof WEB_CHECKOUT_FAILURES)[number];

const FAILURE_CODES: Record<string, WebCheckoutFailure> = {
  INVALID_JSON: "invalidInput",
  INVALID_INPUT: "invalidInput",
  INVALID_PHONE: "invalidPhone",
  WEB_ORDER_NIF_INVALID: "invalidNIF",
  UNAUTHENTICATED: "signedOut",
  WEB_PASSES_CLOSED: "closed",
  WEB_PRODUCT_UNAVAILABLE: "productUnavailable",
  // The account has lifetime Plus.
  WEB_PASS_NOT_NEEDED: "notNeeded",
  // `details.order_id` names the order to resume.
  WEB_ORDER_PENDING: "pending",
  WEB_ORDER_RATE_LIMIT: "rateLimited",
  PAYMENT_GATEWAY_UNAVAILABLE: "gatewayUnavailable",
  PAYMENTS_NOT_CONFIGURED: "notConfigured",
  WEB_ORDER_NOT_FOUND: "notFound",
};

/** The HTTP status `/api/billing/*` answers each failure with (the Edge Function's own, where it has one). */
export const WEB_CHECKOUT_FAILURE_STATUS: Record<WebCheckoutFailure, number> = {
  invalidInput: 400,
  invalidPhone: 400,
  invalidNIF: 400,
  signedOut: 401,
  closed: 403,
  notFound: 404,
  productUnavailable: 409,
  notNeeded: 409,
  pending: 409,
  rateLimited: 429,
  gatewayUnavailable: 502,
  notConfigured: 503,
  unavailable: 503,
};

/** An Edge Function error (`{error: {code}}` and its status) as a failure; an unknown code falls back on the status. */
export function webCheckoutFailure(status: number | null, code: unknown): WebCheckoutFailure {
  if (typeof code === "string" && Object.hasOwn(FAILURE_CODES, code)) return FAILURE_CODES[code];
  if (status === 401) return "signedOut";
  if (status === 404) return "notFound";
  if (status === 429) return "rateLimited";
  return "unavailable";
}

export const isWebCheckoutFailure = (value: unknown): value is WebCheckoutFailure =>
  typeof value === "string" && (WEB_CHECKOUT_FAILURES as readonly string[]).includes(value);

/** What a billing operation answers: the order, or why not (`orderID` with `pending`: the order to resume). */
export type WebOrderResult = { readonly order: WebOrder } | { readonly failure: WebCheckoutFailure; readonly orderID?: string };

/** The checkout request the route accepts (`POST /api/billing/checkout`). */
export interface WebCheckoutInput {
  readonly productID: string;
  readonly method: WebPaymentMethod;
  readonly phone?: string;
  readonly nif?: string | null;
}

/** The route's body as a checkout request; null when its shape is wrong (formats are the server's to judge). */
export function decodeWebCheckoutInput(body: unknown): WebCheckoutInput | null {
  if (!isRecord(body)) return null;
  const { productID, method, phone, nif } = body;
  if (typeof productID !== "string" || !/^[a-z0-9_]{1,40}$/.test(productID) || !isWebPaymentMethod(method)) return null;
  if (phone !== undefined && phone !== null && typeof phone !== "string") return null;
  if (nif !== undefined && nif !== null && typeof nif !== "string") return null;
  if (typeof phone === "string" && phone.length > 32) return null;
  if (typeof nif === "string" && nif.length > 64) return null;
  return {
    productID,
    method,
    ...(typeof phone === "string" && method === "mcx_express" ? { phone } : {}),
    ...(typeof nif === "string" ? { nif } : {}),
  };
}
