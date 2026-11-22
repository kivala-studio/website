import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { publicEnv } from "@/config/public-env";
import { type WebPlan, decodeWebPlans, encodeWebPlan } from "@/domain/billing/web-pass";

import { demoPlans } from "../demo/web-passes";
import { anonymousSupabase } from "../supabase/anonymous-client";
import { readWebPlans } from "./web-passes";

/** Seconds a read of the plans on sale is kept: a price change or the passes opening shows within 5 minutes. */
export const PUBLIC_PLANS_REVALIDATE = 300;

/*
 * `get_web_plans()` as anyone sees it (role `anon`, no session), so one cached answer serves every visitor. The cache
 * holds the plans as exact strings (`encodeWebPlan`); a failed read throws and is not cached.
 */
const publicPlans = unstable_cache(async () => (await readWebPlans(anonymousSupabase())).map(encodeWebPlan), ["public-web-plans-v1"], {
  revalidate: PUBLIC_PLANS_REVALIDATE,
  tags: ["public-web-plans"],
});

/**
 * The Plus web passes on sale, shortest first: `[]` while passes are closed or when they cannot be read, so a public
 * page shows no price rather than an error. Demo mode reads `demo-plans` (`closed` → `[]`). Once per request.
 */
export const getPublicWebPlans = cache(async (): Promise<WebPlan[]> => {
  try {
    const plans = publicEnv.dataMode === "demo" ? await demoPlans() : (decodeWebPlans(await publicPlans()) ?? []);
    return [...plans].sort((a, b) => a.months - b.months);
  } catch {
    return [];
  }
});
