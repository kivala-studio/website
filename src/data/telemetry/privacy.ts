import { APP_ERROR_CATEGORIES, type AppErrorCategory } from "@/domain/errors";

import { isRouteTemplate } from "./route-template";

/*
 * Port of iOS `TelemetryPrivacy` with `platform: "web"`. Every event is rebuilt from an allow-list,
 * so account data, financial values, instrument ids, tokens and free text cannot be sent.
 */

export type Properties = Record<string, unknown>;

/** Handled failures worth reporting; connectivity and user errors are routine. */
export const REPORTED_CATEGORIES: ReadonlySet<AppErrorCategory> = new Set([
  "server",
  "serviceUnavailable",
  "decoding",
  "invalidResponse",
  "invalidState",
  "unknown",
]);

export const EVENTS: ReadonlySet<string> = new Set([
  "$pageview",
  "$exception",
  "onboarding_started",
  "onboarding_step_viewed",
  "onboarding_completed",
  "telemetry_verification",
]);

const METADATA = new Set(["$lib", "$lib_version", "$browser", "$browser_version", "$os", "$device_type", "$session_id", "$exception_level", "$release"]);
const ONBOARDING_STEPS = new Set(["market", "watchlist", "portfolio"]);
const DOMAINS = new Set([
  "market",
  "portfolio",
  "watchlist",
  "auth",
  "account",
  "alerts",
  "push",
  "widgets",
  "news",
  "subscriptions",
  "intelligence",
  "diagnostics",
]);
/** Built-in JavaScript error names keep their type; anything else is reported generically. */
const NATIVE_TYPES = new Set(["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "EvalError", "URIError", "AggregateError"]);
const MECHANISM_KEYS = ["type", "handled", "synthetic", "exception_id", "parent_id", "is_exception_group"];
const FRAME_KEYS = ["platform", "function", "module", "lineno", "colno", "in_app"];

/** The product area of an operation name, never its identifiers. */
export function operationDomain(operation: string): string {
  const root = operation.split(".")[0] ?? "";
  if (root === "telemetry") return "diagnostics";
  return DOMAINS.has(root) ? root : "application";
}

const basename = (path: string) => path.split(/[?#]/)[0]!.split("/").filter(Boolean).at(-1) ?? "";

const pick = (source: Properties, keys: readonly string[]) =>
  Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]));

const isCategory = (value: unknown): value is AppErrorCategory => (APP_ERROR_CATEGORIES as readonly unknown[]).includes(value);

function exceptionList(list: unknown, category: AppErrorCategory | undefined): Properties[] | undefined {
  if (!Array.isArray(list)) return undefined;
  return list.slice(0, 8).map((item: Properties) => {
    const safe: Properties = {};
    if (typeof item.mechanism === "object" && item.mechanism !== null) safe.mechanism = pick(item.mechanism as Properties, MECHANISM_KEYS);
    const type = typeof item.type === "string" && NATIVE_TYPES.has(item.type) ? item.type : "BrowserException";
    safe.type = category ? `InvestAO.${category}` : type;
    safe.value = category ?? "Unhandled application exception";
    const frames = (item.stacktrace as Properties | undefined)?.frames;
    if (Array.isArray(frames)) {
      safe.stacktrace = {
        frames: frames.slice(-100).map((frame: Properties) => {
          const kept = pick(frame, FRAME_KEYS);
          if (typeof frame.filename === "string") kept.filename = basename(frame.filename);
          if (typeof frame.module === "string") kept.module = basename(frame.module);
          return kept;
        }),
      };
    }
    return safe;
  });
}

/** The event as it may leave the browser, or `null` when it must not be sent at all. */
export function sanitize(event: string, properties: Properties, environment: string): Properties | null {
  if (!EVENTS.has(event)) return null;
  const result: Properties = pick(properties, [...METADATA]);
  Object.assign(result, {
    schema_version: 1,
    environment: environment === "production" ? "production" : "development",
    platform: "web",
    $geoip_disable: true,
    $process_person_profile: false,
    $is_identified: false,
  });
  if (isRouteTemplate(properties.$pathname)) result.$pathname = properties.$pathname;
  if (properties.locale === "pt" || properties.locale === "en") result.locale = properties.locale;
  if (typeof properties.onboarding_step === "string" && ONBOARDING_STEPS.has(properties.onboarding_step)) {
    result.onboarding_step = properties.onboarding_step;
  }
  if (properties.completion_method === "skipped" || properties.completion_method === "completed") {
    result.completion_method = properties.completion_method;
  }
  if (properties.verification === true) result.verification = true;
  if (event !== "$exception") return result;

  const category = isCategory(properties.error_category) && REPORTED_CATEGORIES.has(properties.error_category) ? properties.error_category : undefined;
  if (category) {
    result.error_category = category;
    result.operation_domain = operationDomain(typeof properties.operation_domain === "string" ? properties.operation_domain : "");
    const status = properties.http_status;
    if (typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599) result.http_status = status;
  }
  const list = exceptionList(properties.$exception_list, category);
  if (list) result.$exception_list = list;
  return result;
}
