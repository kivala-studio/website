import { POSTHOG_HOST } from "@/config/security";
import type { AppError } from "@/domain/errors";

import { TelemetryErrorLimiter } from "./limiter";
import { type Properties, sanitize } from "./privacy";
import { routeTemplate } from "./route-template";

/**
 * Cookieless PostHog capture. The distinct id is random per page load and lives only in memory:
 * no cookie, no storage, never identified, no person profile. Every event passes `sanitize`.
 */
export class Telemetry {
  private readonly distinctId: string;
  private readonly limiter = new TelemetryErrorLimiter();
  private readonly send: typeof fetch;

  constructor(
    private readonly options: {
      token: string;
      environment: string;
      host?: string;
      send?: typeof fetch;
      randomId?: () => string;
    },
  ) {
    this.send = options.send ?? ((...args) => fetch(...args));
    this.distinctId = (options.randomId ?? (() => crypto.randomUUID()))();
  }

  capture(event: string, properties: Properties = {}): boolean {
    const safe = sanitize(event, { $lib: "investao-web", ...properties }, this.options.environment);
    if (!safe) return false;
    const body = JSON.stringify({
      api_key: this.options.token,
      event,
      distinct_id: this.distinctId,
      properties: safe,
      timestamp: new Date().toISOString(),
    });
    void this.send(`${this.options.host ?? POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "omit",
      keepalive: true,
      body,
    }).catch(() => undefined);
    return true;
  }

  /** A page view reports the route template and locale only. */
  pageview(url: string): boolean {
    const { template, locale } = routeTemplate(url);
    return this.capture("$pageview", { $pathname: template, locale });
  }

  /** A handled failure, rate-limited; routine categories are never reported. */
  reportError(error: AppError, now = Date.now()): boolean {
    if (!this.limiter.allows(error.category, error.operation, now)) return false;
    return this.capture("$exception", {
      error_category: error.category,
      operation_domain: error.operation,
      http_status: error.httpStatus ?? undefined,
      $exception_level: "error",
      $exception_list: [{ type: error.category, mechanism: { type: "generic", handled: true } }],
    });
  }
}
