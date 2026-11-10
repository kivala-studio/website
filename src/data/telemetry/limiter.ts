import type { AppErrorCategory } from "@/domain/errors";

import { REPORTED_CATEGORIES, operationDomain } from "./privacy";

const HOUR_MS = 3_600_000;
const PER_HOUR = 20;
const PER_KEY_MS = 60_000;

/** Caps handled failure reports: 20 per hour and one per (category, domain) per minute (iOS). */
export class TelemetryErrorLimiter {
  private hourStarted: number | undefined;
  private count = 0;
  private lastReported = new Map<string, number>();

  allows(category: AppErrorCategory, operation: string, now: number = Date.now()): boolean {
    if (!REPORTED_CATEGORIES.has(category)) return false;
    if (this.hourStarted === undefined || now < this.hourStarted || now - this.hourStarted >= HOUR_MS) {
      this.hourStarted = now;
      this.count = 0;
      this.lastReported.clear();
    }
    if (this.count >= PER_HOUR) return false;
    const key = `${category}.${operationDomain(operation)}`;
    const last = this.lastReported.get(key);
    if (last !== undefined && now - last < PER_KEY_MS) return false;
    this.lastReported.set(key, now);
    this.count += 1;
    return true;
  }
}
