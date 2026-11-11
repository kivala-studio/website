/** Demo mode's signed-in accounts, chosen by the `demo-account` cookie (see `./account.ts`). */
export const DEMO_ACCOUNT_COOKIE = "demo-account";
export const DEMO_TIERS = ["free", "plus", "pro"] as const;
export type DemoTier = (typeof DEMO_TIERS)[number];

export const isDemoTier = (value: unknown): value is DemoTier => typeof value === "string" && (DEMO_TIERS as readonly string[]).includes(value);

/** Every cookie the demo account keeps its data in; sign-out clears them. */
export const DEMO_COOKIES = [DEMO_ACCOUNT_COOKIE, "demo-watchlist", "demo-comparison-pair"] as const;
