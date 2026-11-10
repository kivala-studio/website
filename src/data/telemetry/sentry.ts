import { routeTemplate } from "./route-template";

/** Sentry ingestion host and project from a DSN; `undefined` when malformed. */
export function parseDsn(dsn: string): { key: string; origin: string; project: string } | undefined {
  try {
    const url = new URL(dsn);
    const project = url.pathname.split("/").filter(Boolean).at(-1);
    if (url.protocol !== "https:" || !url.username || !project) return undefined;
    return { key: url.username, origin: url.origin, project };
  } catch {
    return undefined;
  }
}

const NATIVE_TYPES = new Set(["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "EvalError", "URIError", "AggregateError"]);

/** `at fn (https://host/_next/static/chunks/app.js:1:2)` → reduced frame without paths or queries. */
function frames(stack: string | undefined) {
  return (stack ?? "")
    .split("\n")
    .slice(1, 101)
    .flatMap((line) => {
      const match = /at (?:(.+?) \()?(?:.*\/)?([^/\s?#)]+)(?:[?#][^:)]*)?:(\d+):(\d+)\)?$/.exec(line.trim());
      if (!match) return [];
      return [{ function: match[1] ?? "?", filename: match[2], lineno: Number(match[3]), colno: Number(match[4]), in_app: true }];
    })
    .reverse();
}

/**
 * Unhandled crashes only, with PII off: no message text, no URL (route template instead), no user,
 * breadcrumbs, request data or cookies. Handled failures go to PostHog through `Telemetry`.
 */
export function createCrashReporter(options: { dsn: string; environment: string; send?: typeof fetch }) {
  const target = parseDsn(options.dsn);
  const send = options.send ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  return async function report(error: unknown, url: string): Promise<boolean> {
    if (!target) return false;
    const eventId = crypto.randomUUID().replaceAll("-", "");
    const name = error instanceof Error && NATIVE_TYPES.has(error.name) ? error.name : "BrowserException";
    const event = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: "javascript",
      level: "fatal",
      environment: options.environment === "production" ? "production" : "development",
      tags: { route: routeTemplate(url).template, platform: "web" },
      exception: {
        values: [
          {
            type: name,
            value: "Unhandled application exception",
            mechanism: { type: "onerror", handled: false },
            stacktrace: { frames: frames(error instanceof Error ? error.stack : undefined) },
          },
        ],
      },
    };
    const envelope = [
      JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
      JSON.stringify({ type: "event" }),
      JSON.stringify(event),
    ].join("\n");
    return send(`${target.origin}/api/${target.project}/envelope/?sentry_version=7&sentry_key=${target.key}`, {
      method: "POST",
      credentials: "omit",
      keepalive: true,
      body: envelope,
    }).then(
      () => true,
      () => false,
    );
  };
}
