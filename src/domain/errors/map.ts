import { AppError, CancellationError, type AppErrorCategory } from "./app-error";
import { parseServerRule, type ServerRule } from "./rules";

/*
 * Errors are matched by shape, not by SDK class, so this module stays free of supabase-js.
 * Shapes follow supabase-js v2: postgrest-js `{code, message, details, hint}` (+ response `status`),
 * auth-js `AuthError` (`__isAuthError`, `name`, `status`, `code`), functions-js `Functions*Error` (`context`).
 */

/** PostgREST error body, with the response status when the caller has it. */
export type PostgrestErrorShape = {
  code: string;
  message: string;
  details?: unknown;
  hint?: unknown;
  status?: number;
};

export type AuthErrorShape = {
  name: string;
  message: string;
  status?: number;
  code?: string;
  __isAuthError?: true;
};

export type FunctionsErrorShape = {
  name: "FunctionsHttpError" | "FunctionsRelayError" | "FunctionsFetchError";
  message: string;
  /** `Response` for HTTP errors, the fetch error for fetch failures. */
  context?: unknown;
};

type Bag = Record<string, unknown>;
type Classified = { category: AppErrorCategory; httpStatus?: number | null; rule?: ServerRule | null };

const isBag = (value: unknown): value is Bag => typeof value === "object" && value !== null;
const text = (value: unknown): string => (typeof value === "string" ? value : "");
const status = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;

export function httpCategory(code: number): AppErrorCategory {
  if (code === 401) return "sessionExpired";
  if (code === 403) return "unauthorized";
  if (code === 404) return "missingData";
  if (code === 408 || code === 504) return "timeout";
  if (code === 429) return "rateLimited";
  if (code === 502 || code === 503) return "serviceUnavailable";
  if (code >= 500 && code <= 599) return "server";
  if (code === 400 || code === 409 || code === 422) return "validation";
  return "invalidResponse";
}

const POSTGREST_CODES = new Map<string, AppErrorCategory>(Object.entries({
  PGRST301: "sessionExpired",
  PGRST302: "sessionExpired",
  PGRST303: "sessionExpired",
  "42501": "unauthorized",
  PGRST000: "serviceUnavailable",
  PGRST001: "serviceUnavailable",
  PGRST002: "serviceUnavailable",
  PGRST003: "serviceUnavailable",
  "53300": "serviceUnavailable",
  "57P01": "serviceUnavailable",
  "57P02": "serviceUnavailable",
  "57P03": "serviceUnavailable",
  "23502": "validation",
  "23503": "validation",
  "23505": "validation",
  "23514": "validation",
  "22P02": "validation",
  // Contract §2: P0001 is a named business rule answered with 400; iOS falls through to .server.
  P0001: "validation",
  // Contract §2: PT409, 22023 and 22007 are client-side conflicts or bad arguments; iOS maps them to .server.
  PT409: "validation",
  "22023": "validation",
  "22007": "validation",
  // Contract §2: 28000 means not authenticated; iOS maps it to .server.
  "28000": "unauthenticated",
  // Contract §2: 57014 is a statement timeout; iOS maps it to .server.
  "57014": "timeout",
}) as [string, AppErrorCategory][]);

const AUTH_SESSION_EXPIRED = new Set([
  "session_not_found",
  "session_expired",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "bad_jwt",
]);
const AUTH_VALIDATION = new Set(["invalid_credentials", "weak_password", "validation_failed"]);

const NETWORK_CODES = new Map<string, AppErrorCategory>(Object.entries({
  ENOTFOUND: "offline",
  EAI_AGAIN: "offline",
  ENETUNREACH: "offline",
  ENETDOWN: "offline",
  ETIMEDOUT: "timeout",
  UND_ERR_CONNECT_TIMEOUT: "timeout",
  UND_ERR_HEADERS_TIMEOUT: "timeout",
  UND_ERR_BODY_TIMEOUT: "timeout",
}) as [string, AppErrorCategory][]);

/** Browser and Node wordings of a failed `fetch` (`TypeError`). */
const FETCH_FAILURE = /fetch|network|load failed/i;
/** postgrest-js reports a failed fetch as an error body whose message starts with the fetch error's name. */
const POSTGREST_TRANSPORT = /^(TypeError|FetchError|AbortError|TimeoutError)\b/;

function isAuthShape(error: Bag): boolean {
  return error.__isAuthError === true || /^Auth[A-Za-z]*Error$/.test(text(error.name));
}

function isPostgrestShape(error: Bag): boolean {
  return typeof error.code === "string" && typeof error.message === "string" && ("details" in error || "hint" in error);
}

function isPostgrestTransport(error: Bag): boolean {
  return error.status === 0 || (error.code === "" && POSTGREST_TRANSPORT.test(text(error.message)));
}

/** Connectivity category of a failed request; undici puts the system code on `cause`. */
function transportCategory(error: unknown): AppErrorCategory {
  if (!isBag(error)) return "connectionLost";
  if (error.name === "TimeoutError" || text(error.message).startsWith("TimeoutError")) return "timeout";
  const code = text(error.code) || (isBag(error.cause) ? text(error.cause.code) : "");
  return NETWORK_CODES.get(code) ?? "connectionLost";
}

/** Cancellation is control flow: aborted fetches, `CancellationError`, and either wrapped in another error. */
export function isCancellation(error: unknown): boolean {
  if (!isBag(error)) return false;
  const name = text(error.name);
  if (name === "CancellationError" || name === "AbortError") return true;
  if (error instanceof AppError) return isCancellation(error.cause);
  if (name === "FunctionsFetchError") return isCancellation(error.context);
  return isPostgrestShape(error) && isPostgrestTransport(error) && text(error.message).startsWith("AbortError");
}

function classifyAuth(error: Bag): Classified {
  const name = text(error.name);
  const code = status(error.status);
  let category: AppErrorCategory = "validation";
  let httpStatus: number | null = null;
  if (name === "AuthApiError" && code !== null) {
    httpStatus = code;
    category = httpCategory(code);
  } else if (name === "AuthRetryableFetchError") {
    // auth-js wraps fetch failures (status 0) and gateway errors here; iOS sees these as URLError.
    httpStatus = code;
    category = code === null ? transportCategory(error) : httpCategory(code);
  }
  const errorCode = text(error.code);
  if (AUTH_SESSION_EXPIRED.has(errorCode)) category = "sessionExpired";
  else if (AUTH_VALIDATION.has(errorCode)) category = "validation";
  if (name === "AuthSessionMissingError") category = "unauthenticated";
  if (name === "AuthInvalidJwtError") category = "sessionExpired";
  return { category, httpStatus };
}

function classifyPostgrest(error: Bag): Classified {
  if (isPostgrestTransport(error)) return { category: transportCategory(error) };
  const code = text(error.code);
  const httpStatus = status(error.status);
  const known = POSTGREST_CODES.get(code);
  if (known) return { category: known, httpStatus, rule: parseServerRule(code, error.message, error.details) };
  // A non-JSON gateway body has no code: only the status describes it.
  if (code === "" && httpStatus !== null) return { category: httpCategory(httpStatus), httpStatus };
  return { category: "server", httpStatus };
}

function classify(error: unknown): Classified {
  if (!isBag(error)) return { category: "unknown" };
  const name = text(error.name);
  switch (name) {
    case "DecodingError":
    case "SyntaxError":
    case "ZodError":
      return { category: "decoding" };
    case "AccountSessionError":
      return { category: "unauthenticated" };
    case "TimeoutError":
      return { category: "timeout" };
    case "HttpError": {
      const code = status(error.status);
      return { category: code === null ? "invalidResponse" : httpCategory(code), httpStatus: code };
    }
    case "FunctionsRelayError":
      return { category: "serviceUnavailable" };
    case "FunctionsHttpError": {
      const code = isBag(error.context) ? status(error.context.status) : null;
      return { category: code === null ? "invalidResponse" : httpCategory(code), httpStatus: code };
    }
    case "FunctionsFetchError":
      return { category: transportCategory(error.context) };
  }
  if (isAuthShape(error)) return classifyAuth(error);
  if (isPostgrestShape(error)) return classifyPostgrest(error);
  if (name === "TypeError" && FETCH_FAILURE.test(text(error.message))) return { category: transportCategory(error) };
  return { category: "unknown" };
}

/** Maps any thrown value to a domain error. Returns null for cancellation, which must never surface. */
export function mapError(error: unknown, operation: string): AppError | null {
  if (isCancellation(error)) return null;
  if (error instanceof AppError) return error;
  const { category, httpStatus = null, rule = null } = classify(error);
  return new AppError(category, { operation, cause: error, httpStatus, rule });
}

/** What a repository rethrows: the domain error, or `CancellationError` for aborted work. */
export function boundaryError(error: unknown, operation: string): AppError | CancellationError {
  return mapError(error, operation) ?? new CancellationError();
}

/** The named business rule behind an error, also when wrapped in `AppError`. */
export function serverRule(error: unknown): ServerRule | null {
  if (error instanceof AppError) return error.rule ?? serverRule(error.cause);
  if (!isBag(error) || !isPostgrestShape(error)) return null;
  return parseServerRule(error.code, error.message, error.details);
}

/** SQLSTATE or PostgREST code (`23505` duplicate name, `PT409` reload), also when wrapped in `AppError`. */
export function postgrestCode(error: unknown): string | null {
  if (error instanceof AppError) return postgrestCode(error.cause);
  return isBag(error) && isPostgrestShape(error) && error.code !== "" ? (error.code as string) : null;
}

/** Seconds the server asked clients to wait (`retry_after_seconds` in an `HttpError` body). */
/** `retry_after_seconds` from an Edge Function error body (object or JSON text). */
export function retryAfterFromBody(body: unknown): number | null {
  let value = body;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const seconds = isBag(value) ? value.retry_after_seconds : null;
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export function retryAfterSeconds(error: unknown): number | null {
  if (error instanceof AppError) return retryAfterSeconds(error.cause);
  if (!isBag(error) || error.name !== "HttpError") return null;
  return retryAfterFromBody(error.body);
}
