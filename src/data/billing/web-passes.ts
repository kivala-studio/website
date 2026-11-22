import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type WebCheckoutInput,
  type WebOrder,
  type WebOrderResult,
  type WebPlan,
  decodeWebOrder,
  decodeWebOrders,
  decodeWebPlans,
  webCheckoutFailure,
} from "@/domain/billing/web-pass";
import { DecodingError } from "@/domain/errors";
import { quoteInexactNumbers } from "@/domain/market/exact-json";

import { isUUID } from "../account/session";
import { REQUEST_TIMEOUT_MS } from "../http/exact-fetch";
import { unwrap } from "../supabase/read";
import { supabaseConfig } from "../supabase/options";

/*
 * Plus web passes for the signed-in account (contract §7.5). Reads and cancel are PostgREST RPCs scoped by the
 * session; checkout and the live status are Edge Functions, called only from here with the member's token.
 * The phone number and NIF travel only in the Edge Function's JSON body: never logged, never in a URL.
 */

/** `get_web_plans()`: `[]` while web passes are closed to this account. */
export async function readWebPlans(client: SupabaseClient): Promise<WebPlan[]> {
  const plans = decodeWebPlans(unwrap(await client.rpc("get_web_plans")));
  if (!plans) throw new DecodingError("web plans");
  return plans;
}

/** `get_web_orders()`: the 50 latest orders, newest first. */
export async function readWebOrders(client: SupabaseClient): Promise<WebOrder[]> {
  const orders = decodeWebOrders(unwrap(await client.rpc("get_web_orders")));
  if (!orders) throw new DecodingError("web orders");
  return orders;
}

/** `cancel_web_order`: the order (`cancelled` if it was pending), or null when it is not this account's. */
export async function cancelWebOrder(client: SupabaseClient, orderID: string): Promise<WebOrder | null> {
  const body = unwrap(await client.rpc("cancel_web_order", { order_id: orderID }));
  if (body === null) return null;
  const order = decodeWebOrder(body);
  if (!order) throw new DecodingError("web order");
  return order;
}

type Dependencies = { fetch?: typeof fetch };

/** One member Edge Function call: the order it answers, or its typed failure. */
async function orderFunction(client: SupabaseClient, name: string, body: Record<string, unknown>, { fetch: send = fetch }: Dependencies): Promise<WebOrderResult> {
  const token = (await client.auth.getSession()).data.session?.access_token;
  if (!token) return { failure: "signedOut" };
  const { url, key } = supabaseConfig();
  let response: Response;
  let text: string;
  try {
    response = await send(`${url}/functions/v1/${name}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, apikey: key, "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    text = await response.text();
  } catch {
    return { failure: "unavailable" };
  }
  let parsed: unknown = null;
  try {
    // Amounts keep their digits (numeric(14,2) as a JSON number).
    parsed = JSON.parse(quoteInexactNumbers(text));
  } catch {
    // An unreadable body is judged by its status alone.
  }
  if (response.ok) {
    const order = decodeWebOrder(parsed);
    return order ? { order } : { failure: "unavailable" };
  }
  const error = typeof parsed === "object" && parsed !== null ? (parsed as { error?: { code?: unknown; details?: { order_id?: unknown } } }).error : undefined;
  const failure = webCheckoutFailure(response.status, error?.code);
  const pendingID = error?.details?.order_id;
  return failure === "pending" && isUUID(pendingID) ? { failure, orderID: pendingID.toLowerCase() } : { failure };
}

/** `web-checkout`: opens a pending order (Express pushes to the phone; a reference order carries its reference). */
export function startWebCheckout(client: SupabaseClient, input: WebCheckoutInput, dependencies: Dependencies = {}): Promise<WebOrderResult> {
  return orderFunction(
    client,
    "web-checkout",
    {
      product_id: input.productID,
      method: input.method,
      ...(input.method === "mcx_express" ? { phone: input.phone ?? "" } : {}),
      ...(input.nif ? { nif: input.nif } : {}),
    },
    dependencies,
  );
}

/** `web-order-status`: the order after the server asked the payment provider (settles it when paid). */
export function readWebOrderStatus(client: SupabaseClient, orderID: string, dependencies: Dependencies = {}): Promise<WebOrderResult> {
  return orderFunction(client, "web-order-status", { order_id: orderID }, dependencies);
}
