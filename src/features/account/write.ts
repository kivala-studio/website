import "server-only";

import { type AccountSession, accountSession } from "@/data/account/session";
import { AccountSessionError, type AppErrorCategory, type ServerRule, mapError } from "@/domain/errors";

/** What an account write sends back. `stale`: the session belongs to another account now (nothing was written). */
export type AccountResult<T> =
  | { status: "ok"; value: T }
  | { status: "stale" }
  | { status: "failed"; error: { category: AppErrorCategory; httpStatus: number | null; rule: ServerRule | null } };

export function failed(error: unknown, operation: string): AccountResult<never> {
  const mapped = mapError(error, operation);
  if (!mapped) return { status: "stale" };
  return { status: "failed", error: { category: mapped.category, httpStatus: mapped.httpStatus, rule: mapped.rule } };
}

/** An argument the server would refuse anyway (a malformed id or value): nothing is sent. */
export const invalidArgument = () => Object.assign(new Error("Invalid argument"), { code: "22023", message: "Invalid argument", details: null, hint: null, status: 400 });

/**
 * Runs one write for the verified session while it is still `expectedUserID`; every failure becomes a typed
 * result (the browser maps it like any other error).
 */
export async function accountWrite<T>(expectedUserID: string, operation: string, run: (session: AccountSession) => Promise<T>): Promise<AccountResult<T>> {
  try {
    const session = await accountSession();
    if (!session) return failed(new AccountSessionError(), operation);
    if (session.userID !== expectedUserID) return { status: "stale" };
    return { status: "ok", value: await run(session) };
  } catch (error) {
    return failed(error, operation);
  }
}
