import { AppError, CancellationError, DecodingError, HttpError } from "@/domain/errors";

import type { AccountResult } from "./write";

/** A server action's result as a value, or the error a store maps: `stale` is a cancellation (another account). */
export async function settle<T>(call: Promise<AccountResult<T>>, operation: string): Promise<T> {
  const result = await call;
  if (result.status === "ok") return result.value;
  if (result.status === "stale") throw new CancellationError();
  const { category, httpStatus, rule } = result.error;
  throw new AppError(category, { operation, httpStatus, rule });
}

/** GETs an account route for `userID`; another account's answer is a cancellation. */
export async function readAccountRoute(url: string, userID: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new HttpError(response.status);
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null) throw new DecodingError(url);
  if ((body as { userID?: unknown }).userID !== userID) throw new CancellationError();
  return body as Record<string, unknown>;
}
