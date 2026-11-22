import { accountSession, isUUID, signedOut } from "@/data/account/session";
import { billingFailure, orderResponse } from "@/data/billing/responses";
import { readWebOrderStatus } from "@/data/billing/web-passes";
import { demoWebOrderStatus } from "@/data/demo/web-passes";

/** One order's live status (the server asks the payment provider first): poll while `pending`. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!isUUID(id)) return billingFailure("notFound");
  const session = await accountSession();
  if (!session) return signedOut();
  const orderID = id.toLowerCase();
  try {
    const result = session.kind === "demo" ? await demoWebOrderStatus(session.account, orderID) : await readWebOrderStatus(session.client, orderID);
    return orderResponse(session.userID, result);
  } catch {
    return billingFailure("unavailable");
  }
}
