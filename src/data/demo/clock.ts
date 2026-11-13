import "server-only";

import { cookies } from "next/headers";

import { publicEnv } from "@/config/public-env";

/*
 * Demo mode only: `demo-clock` (epoch milliseconds) moves the server's clock for one browser, so Friday after the
 * close, Saturday and Sunday can be exercised on any day. The demo calendar then follows the regular week instead
 * of the scenario's all-day session or closure. Outside demo mode the cookie means nothing.
 */
export const DEMO_CLOCK_COOKIE = "demo-clock";

export const parseDemoClock = (value: string | undefined): number | undefined => {
  const parsed = value === undefined || !/^\d{12,14}$/.test(value) ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** The demo clock from a `cookie` request header (routes that read the request directly). */
export function demoClockFromHeader(header: string | null): number | undefined {
  if (publicEnv.dataMode !== "demo" || !header) return undefined;
  const value = header
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === DEMO_CLOCK_COOKIE)?.[1];
  return parseDemoClock(value);
}

/** Now, as the request sees it: the demo clock when one is set, else the real clock. */
export async function demoNow(): Promise<number> {
  if (publicEnv.dataMode !== "demo") return Date.now();
  return parseDemoClock((await cookies()).get(DEMO_CLOCK_COOKIE)?.value) ?? Date.now();
}
