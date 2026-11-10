import type { Instrumentation } from "next";

/** Server crashes go to Sentry with the same reduction as the browser: route template, no message, no request data. */
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  const { publicEnv } = await import("@/config/public-env");
  if (!publicEnv.sentryDsn || publicEnv.dataMode === "demo") return;
  const { createCrashReporter } = await import("@/data/telemetry/sentry");
  const environment = publicEnv.dataMode === "production" ? "production" : "development";
  await createCrashReporter({ dsn: publicEnv.sentryDsn, environment })(error, request.path);
};
