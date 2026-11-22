import { ACCOUNT_HEADERS, accountSession, signedOut } from "@/data/account/session";
import { readWebOrders, readWebPlans } from "@/data/billing/web-passes";
import { billingFailure } from "@/data/billing/responses";
import { demoWebPlansAndOrders } from "@/data/demo/web-passes";
import { encodeWebOrder, encodeWebPlan } from "@/domain/billing/web-pass";

/** `/planos`' data: the web passes on sale to this account (`[]` while closed) and its orders, newest first. */
export async function GET(): Promise<Response> {
  const session = await accountSession();
  if (!session) return signedOut();
  try {
    const { plans, orders } =
      session.kind === "demo"
        ? await demoWebPlansAndOrders(session.account)
        : await Promise.all([readWebPlans(session.client), readWebOrders(session.client)]).then(([plans, orders]) => ({ plans, orders }));
    return Response.json({ userID: session.userID, plans: plans.map(encodeWebPlan), orders: orders.map(encodeWebOrder) }, { headers: ACCOUNT_HEADERS });
  } catch {
    return billingFailure("unavailable");
  }
}
