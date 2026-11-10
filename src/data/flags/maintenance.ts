/*
 * The `web-maintenance` remote gate (iOS `AppFeatureFlagStore`, maintenance part). PostHog's public
 * `/flags` evaluation is called from the server with a fixed anonymous id: no capture, no account.
 * Refreshed at most every 300 s (5 s when forced); a successful answer counts for 3600 s, after
 * which the gate opens again (fail-open). Snapshot `control.maintenance` is separate: it only slows
 * polling.
 */

export const MAINTENANCE_REFRESH_MS = 300_000;
export const MAINTENANCE_FORCED_REFRESH_MS = 5_000;
export const MAINTENANCE_CACHE_MS = 3_600_000;
const FLAGS_TIMEOUT_MS = 8_000;
/** Shared by every visitor: flags are evaluated globally, never per person. */
const DISTINCT_ID = "investao-web";

export const maintenanceFlagKey = (production: boolean) => (production ? "web-maintenance" : "web-maintenance-development");

export class FlagsUnavailableError extends Error {
  override readonly name = "FlagsUnavailableError";
}

/** Maintenance state from a `/flags?v=2` body; partial evaluations count as failures. */
export function parseMaintenanceFlag(body: unknown, flagKey: string): boolean {
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : undefined;
  const flags = record?.flags;
  if (!record || typeof flags !== "object" || flags === null) throw new FlagsUnavailableError("flags");
  const quota = record.quotaLimited;
  if (record.errorsWhileComputingFlags === true || (Array.isArray(quota) && quota.includes("feature_flags"))) {
    throw new FlagsUnavailableError("flags");
  }
  const flag = (flags as Record<string, unknown>)[flagKey];
  return typeof flag === "object" && flag !== null && (flag as { enabled?: unknown }).enabled === true;
}

export async function fetchMaintenanceFlag(options: {
  token: string;
  host: string;
  flagKey: string;
  environment: string;
  send?: typeof fetch;
}): Promise<boolean> {
  const send = options.send ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const response = await send(`${options.host}/flags?v=2`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(FLAGS_TIMEOUT_MS),
    body: JSON.stringify({
      api_key: options.token,
      distinct_id: DISTINCT_ID,
      person_properties: { platform: "web", environment: options.environment },
    }),
  });
  if (!response.ok) throw new FlagsUnavailableError(`HTTP ${response.status}`);
  return parseMaintenanceFlag(await response.json(), options.flagKey);
}

/** Successful answers by namespace (environment + token), shared by gates in this server process. */
export type MaintenanceCache = Map<string, number>;

export class MaintenanceGate {
  private lastAttempt: number | undefined;
  private refreshing = false;
  private failed = false;

  constructor(
    private readonly options: {
      fetch: (() => Promise<boolean>) | undefined;
      namespace: string;
      cache: MaintenanceCache;
    },
  ) {}

  /** Whether the last refresh failed (the cached answer, if any, still applies). */
  get refreshFailed(): boolean {
    return this.failed;
  }

  isInMaintenance(now: number): boolean {
    if (!this.options.fetch) return false;
    const fetchedAt = this.options.cache.get(this.options.namespace);
    return fetchedAt !== undefined && now >= fetchedAt && now - fetchedAt < MAINTENANCE_CACHE_MS;
  }

  async refresh({ force = false, now = Date.now() }: { force?: boolean; now?: number } = {}): Promise<void> {
    const fetch = this.options.fetch;
    if (!fetch || this.refreshing) return;
    const last = this.lastAttempt;
    if (last !== undefined && now >= last && now - last < (force ? MAINTENANCE_FORCED_REFRESH_MS : MAINTENANCE_REFRESH_MS)) return;
    this.lastAttempt = now;
    this.refreshing = true;
    try {
      if (await fetch()) this.options.cache.set(this.options.namespace, now);
      else this.options.cache.delete(this.options.namespace);
      this.failed = false;
    } catch {
      this.failed = true;
    } finally {
      this.refreshing = false;
    }
  }
}
