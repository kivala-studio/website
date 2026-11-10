import "server-only";

import { publicEnv } from "@/config/public-env";
import { POSTHOG_HOST } from "@/config/security";

import { MaintenanceGate, fetchMaintenanceFlag, maintenanceFlagKey } from "./maintenance";

const production = publicEnv.dataMode === "production";
const token = publicEnv.posthogToken;

const gate = new MaintenanceGate({
  // Demo mode never calls PostHog.
  fetch:
    token && publicEnv.dataMode !== "demo"
      ? () =>
          fetchMaintenanceFlag({
            token,
            host: POSTHOG_HOST,
            flagKey: maintenanceFlagKey(production),
            environment: production ? "production" : "development",
          })
      : undefined,
  namespace: `${production ? "production" : "development"}.${token ?? ""}`,
  cache: new Map(),
});

/**
 * Whether pages render the maintenance screen. Answers from the cached flag at once and refreshes
 * in the background, so a slow or failing PostHog never delays or blocks a page.
 */
export function maintenanceActive(): boolean {
  void gate.refresh();
  return gate.isInMaintenance(Date.now());
}
