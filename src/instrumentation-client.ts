import { reportCrash, telemetry } from "@/data/telemetry/client";

try {
  telemetry?.pageview(window.location.href);
  const report = reportCrash;
  if (report) {
    window.addEventListener("error", (event) => void report(event.error, window.location.href));
    window.addEventListener("unhandledrejection", (event) => void report(event.reason, window.location.href));
  }
} catch {
  // Telemetry never breaks the page.
}

/** Client navigations report the destination's route template. */
export function onRouterTransitionStart(url: string) {
  telemetry?.pageview(url);
}
