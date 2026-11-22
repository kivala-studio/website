import {
  type WebCheckoutInput,
  type WebOrder,
  type WebOrderResult,
  type WebPlan,
  decodeWebOrder,
  decodeWebOrders,
  decodeWebPlans,
  isWebCheckoutFailure,
} from "@/domain/billing/web-pass";
import { CancellationError, DecodingError } from "@/domain/errors";
import { readAccountRoute } from "@/features/account/results";

/*
 * `/planos`' calls to the billing routes for one signed-in account. Every answer names its account: another
 * account's answer is a cancellation, never applied. Nothing retries: a failed status read waits for the next poll.
 */

export type PlansPage = { readonly plans: WebPlan[]; readonly orders: WebOrder[] };

/** The plans on sale (`[]` while closed) and the account's orders, newest first. Throws on failure. */
export async function readPlansPage(userID: string, signal?: AbortSignal): Promise<PlansPage> {
  const body = await readAccountRoute("/api/billing/plans", userID, signal);
  const plans = decodeWebPlans(body.plans);
  const orders = decodeWebOrders(body.orders);
  if (!plans || !orders) throw new DecodingError("billing plans");
  return { plans: [...plans].sort((a, b) => a.months - b.months), orders };
}

/** One billing route that answers an order or `{error, orderID?}`; a lost session is `signedOut`. */
async function orderCall(url: string, userID: string, init: RequestInit = {}): Promise<WebOrderResult> {
  let response: Response;
  let body: unknown = null;
  try {
    response = await fetch(url, { ...init, cache: "no-store" });
    body = await response.json().catch(() => null);
  } catch {
    if (init.signal?.aborted) throw new CancellationError();
    return { failure: "unavailable" };
  }
  if (response.status === 401) return { failure: "signedOut" };
  const fields = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  if (response.ok) {
    if (fields.userID !== userID) throw new CancellationError();
    const order = decodeWebOrder(fields.order);
    return order ? { order } : { failure: "unavailable" };
  }
  if (!isWebCheckoutFailure(fields.error)) return { failure: "unavailable" };
  return typeof fields.orderID === "string" ? { failure: fields.error, orderID: fields.orderID } : { failure: fields.error };
}

const post = (body?: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

/** Opens a pending order; the phone and NIF travel only in this POST body. */
export const startWebCheckout = (userID: string, input: WebCheckoutInput) => orderCall("/api/billing/checkout", userID, post(input));

/** The order's live status (the server asks the payment provider first). */
export const readWebOrder = (userID: string, orderID: string, signal?: AbortSignal) =>
  orderCall(`/api/billing/order/${encodeURIComponent(orderID)}`, userID, { signal });

export const cancelWebOrder = (userID: string, orderID: string) => orderCall(`/api/billing/order/${encodeURIComponent(orderID)}/cancel`, userID, post());
