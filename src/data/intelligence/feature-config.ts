import { publicEnv } from "@/config/public-env";
import {
  FeatureControlStore,
  INTELLIGENCE_FEATURES,
  InvalidFeatureConfiguration,
  type IntelligenceAvailability,
  type IntelligenceFeature,
  intelligenceAudience,
} from "@/domain/intelligence/feature-controls";

import { browserSupabase } from "../supabase/browser-client";

/*
 * The browser's copy of `intelligence_feature_configuration` (contract §3.12): one row, `id = true`, readable by
 * anon and authenticated. Demo mode has no backend: it serves a document with every client feature on, so the
 * Saturday Discover and Week-ahead offers can be exercised.
 */

const DEMO_OFF: ReadonlySet<IntelligenceFeature> = new Set(["intelligence_notifications", "personalization_v2"]);

/** A valid, current document: effective a minute ago, expiring in six days (the lifetime limit is seven). */
export function demoFeatureConfiguration(now: number): unknown {
  const iso = (ms: number) => `${new Date(ms).toISOString().slice(0, 19)}Z`;
  return {
    schema_version: 1,
    version: 1,
    minimum_app_build: 0,
    effective_at: iso(now - 60_000),
    expires_at: iso(now + 6 * 86_400_000),
    features: Object.fromEntries(
      INTELLIGENCE_FEATURES.map((feature) => [
        feature,
        { enabled: !DEMO_OFF.has(feature), kill_switch: false, rollout_percentage: 100, rollout_salt: "demo", audiences: ["production", "beta", "internal"] },
      ]),
    ),
  };
}

async function fetchPayload(): Promise<unknown> {
  const { data, error } = await browserSupabase().from("intelligence_feature_configuration").select("payload").eq("id", true).single();
  if (error) throw error;
  if (!data || typeof data !== "object" || !("payload" in data)) throw new InvalidFeatureConfiguration();
  return (data as { payload: unknown }).payload;
}

const storage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

let store: FeatureControlStore | undefined;

function controlStore(now: number): FeatureControlStore {
  store ??= new FeatureControlStore({
    fetch: publicEnv.dataMode === "demo" ? async (now) => demoFeatureConfiguration(now) : fetchPayload,
    storage: storage(),
    audience: intelligenceAudience(publicEnv.dataMode, process.env.NEXT_PUBLIC_VERCEL_ENV),
    now,
  });
  return store;
}

/** Availability now, refreshing the document in the background when it is due (at most once a minute). */
export function intelligenceAvailability(now: number = Date.now()): IntelligenceAvailability {
  const current = controlStore(now);
  void current.refresh(now);
  return current.availability(now);
}

/** Waits for a due refresh first; for callers that are about to run the engine anyway. */
export async function refreshedIntelligenceAvailability(now: number = Date.now()): Promise<IntelligenceAvailability> {
  const current = controlStore(now);
  await current.refresh(now);
  return current.availability(now);
}
