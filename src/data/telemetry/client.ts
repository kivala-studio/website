import { publicEnv } from "@/config/public-env";

import { createCrashReporter } from "./sentry";
import { Telemetry } from "./telemetry";

const environment = publicEnv.dataMode === "production" ? "production" : "development";
// Demo mode (tests, screenshots) never sends telemetry.
const enabled = typeof window !== "undefined" && publicEnv.dataMode !== "demo";

/** The tab's PostHog client, or `undefined` when telemetry is off. */
export const telemetry =
  enabled && publicEnv.posthogToken ? new Telemetry({ token: publicEnv.posthogToken, environment }) : undefined;

/** The tab's Sentry crash reporter, or `undefined` when crash reporting is off. */
export const reportCrash =
  enabled && publicEnv.sentryDsn ? createCrashReporter({ dsn: publicEnv.sentryDsn, environment }) : undefined;
