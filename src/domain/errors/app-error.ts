import type { ServerRule } from "./rules";

export const APP_ERROR_CATEGORIES = [
  "offline",
  "timeout",
  "connectionLost",
  "server",
  "serviceUnavailable",
  "rateLimited",
  "unauthenticated",
  "sessionExpired",
  "unauthorized",
  "decoding",
  "invalidResponse",
  "missingData",
  "unavailableInstrument",
  "unsupportedOperation",
  "validation",
  "invalidState",
  "unknown",
] as const;

export type AppErrorCategory = (typeof APP_ERROR_CATEGORIES)[number];

/** Failures retried or dismissed together: one banner, one "try again". */
export type CauseGroup = "connectivity" | "backend" | Exclude<AppErrorCategory, "offline" | "timeout" | "connectionLost" | "server" | "serviceUnavailable">;

const USER_RETRYABLE = new Set<AppErrorCategory>([
  "offline",
  "timeout",
  "connectionLost",
  "server",
  "serviceUnavailable",
  "rateLimited",
  "unknown",
]);

export type AppErrorInit = {
  operation?: string;
  cause?: unknown;
  httpStatus?: number | null;
  rule?: ServerRule | null;
};

/**
 * Domain failure. Carries diagnostics only: `message` is the category, never backend text.
 * The original error stays in `cause` for debugging and must not be shown or logged.
 */
export class AppError extends Error {
  override readonly name = "AppError";
  readonly category: AppErrorCategory;
  /** Dotted operation name (`market.load`, `watchlist.<symbol>`); selects the failure title. */
  readonly operation: string;
  readonly httpStatus: number | null;
  /** Named server rule (`P0001`), when the backend refused the action on purpose. */
  readonly rule: ServerRule | null;

  constructor(category: AppErrorCategory, { operation = "application", cause, httpStatus = null, rule = null }: AppErrorInit = {}) {
    super(category, cause === undefined ? undefined : { cause });
    this.category = category;
    this.operation = operation;
    this.httpStatus = httpStatus;
    this.rule = rule;
  }

  get requiresAuthentication(): boolean {
    return this.category === "unauthenticated" || this.category === "sessionExpired";
  }

  /** The user may be offered a retry. Nothing retries on its own (AGENTS.md rule 9). */
  get userCanRetry(): boolean {
    return USER_RETRYABLE.has(this.category);
  }

  get causeGroup(): CauseGroup {
    switch (this.category) {
      case "offline":
      case "timeout":
      case "connectionLost":
        return "connectivity";
      case "server":
      case "serviceUnavailable":
        return "backend";
      default:
        return this.category;
    }
  }
}

/** Equality ignores the underlying error, as on iOS. */
export function sameAppError(a: AppError, b: AppError): boolean {
  return a.category === b.category && a.operation === b.operation && a.httpStatus === b.httpStatus;
}

/** Control flow, never a visible failure. Repositories throw it when a request was aborted. */
export class CancellationError extends Error {
  override readonly name = "CancellationError";
  constructor() {
    super("cancelled");
  }
}

/** A payload that does not match the expected shape. */
export class DecodingError extends Error {
  override readonly name = "DecodingError";
}

/** A user-scoped call made without a signed-in account. */
export class AccountSessionError extends Error {
  override readonly name = "AccountSessionError";
}

/** Non-2xx response from a raw `fetch` (Edge Functions are called from route handlers). */
export class HttpError extends Error {
  override readonly name = "HttpError";
  /** Parsed JSON or raw text. Read only for `retry_after_seconds`; never displayed or logged. */
  readonly body: unknown;
  constructor(
    readonly status: number,
    body?: unknown,
  ) {
    super(`HTTP ${status}`);
    this.body = body;
  }
}
