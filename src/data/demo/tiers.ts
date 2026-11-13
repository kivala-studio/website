/** Demo mode's signed-in accounts, chosen by the `demo-account` cookie (see `./account.ts`). */
export const DEMO_ACCOUNT_COOKIE = "demo-account";
/** `pro` is kept as another Plus account: the backend folded Pro into Plus. */
export const DEMO_TIERS = ["free", "plus", "pro"] as const;
export type DemoTier = (typeof DEMO_TIERS)[number];

export const isDemoTier = (value: unknown): value is DemoTier => typeof value === "string" && (DEMO_TIERS as readonly string[]).includes(value);

/** Every cookie the demo account keeps its data in; sign-out clears them. */
export const DEMO_COOKIES = [
  DEMO_ACCOUNT_COOKIE,
  "demo-watchlist",
  "demo-comparison-pair",
  "demo-automatic",
  "demo-groups",
  "demo-rules",
  "demo-sensitivity",
  "demo-activity-read",
  "demo-notification-preferences",
  "demo-portfolio",
  "demo-portfolio-scenario",
  "demo-portfolio-books",
  "demo-portfolio-cash",
  "demo-portfolio-shares",
] as const;
