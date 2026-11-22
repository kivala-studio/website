import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import type { WebCheckoutInput, WebOrder, WebOrderResult, WebPlan } from "@/domain/billing/web-pass";

import { COOKIE_OPTIONS, type DemoAccount } from "./account";
import { DEMO_WEB_ORDERS_COOKIE } from "./tiers";
import { DEMO_WEB_PLANS, type DemoWebOrder, decodeDemoOrders, demoCancel, demoCheckout, demoWebOrder, demoWebOrders, encodeDemoOrders } from "./web-pass-ledger";

/*
 * Demo mode's web pass endpoints, backed by a cookie of the same browser (see `./web-pass-ledger.ts` for the
 * provider's behaviour). `demo-plans=closed` makes `get_web_plans()` answer `[]` and checkout `closed`, as
 * while the server flag is off. Orders settle on the real clock, not `demo-clock`.
 */
export const DEMO_PLANS_COOKIE = "demo-plans";

/** The demo plans on sale: `[]` with `demo-plans=closed`. Read by `/api/billing/plans` and the public `/plus`. */
export async function demoPlans(): Promise<WebPlan[]> {
  return (await cookies()).get(DEMO_PLANS_COOKIE)?.value === "closed" ? [] : [...DEMO_WEB_PLANS];
}

const readOrders = async () => decodeDemoOrders((await cookies()).get(DEMO_WEB_ORDERS_COOKIE)?.value);

const saveOrders = async (orders: readonly DemoWebOrder[]) => (await cookies()).set(DEMO_WEB_ORDERS_COOKIE, encodeDemoOrders(orders), COOKIE_OPTIONS);

const store = (account: DemoAccount) => account.login !== "free";

export async function demoWebPlansAndOrders(account: DemoAccount): Promise<{ plans: WebPlan[]; orders: WebOrder[] }> {
  return { plans: await demoPlans(), orders: demoWebOrders(await readOrders(), Date.now(), store(account)) };
}

export async function demoStartCheckout(account: DemoAccount, input: WebCheckoutInput): Promise<WebOrderResult> {
  const orders = await readOrders();
  const checkout = demoCheckout(orders, input, { now: Date.now(), id: randomUUID(), login: account.login, plans: await demoPlans() });
  if ("order" in checkout.result) await saveOrders(checkout.orders);
  return checkout.result;
}

export async function demoWebOrderStatus(account: DemoAccount, orderID: string): Promise<WebOrderResult> {
  const order = demoWebOrder(await readOrders(), orderID, Date.now(), store(account));
  return order ? { order } : { failure: "notFound" };
}

export async function demoCancelWebOrder(account: DemoAccount, orderID: string): Promise<WebOrder | null> {
  const cancel = demoCancel(await readOrders(), orderID, Date.now(), account.login);
  if (cancel.order?.status === "cancelled") await saveOrders(cancel.orders);
  return cancel.order;
}
