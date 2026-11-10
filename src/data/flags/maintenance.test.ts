import { describe, expect, it } from "vitest";

import { type MaintenanceCache, MaintenanceGate, maintenanceFlagKey, parseMaintenanceFlag } from "./maintenance";

/*
 * Port of the maintenance cases of Tests/MarketDiscoveryTests/AppUpdatePolicyTests.swift (4 of 7;
 * the version-comparison and forced-update cases have no web counterpart). The web gate has no
 * persistent store: "restored" gates share the server-process cache instead of UserDefaults.
 */

const KEY = maintenanceFlagKey(true);
const SECOND = 1000;

/** iOS `UpdateRepositoryStub`, maintenance part. */
function stub() {
  const state = { enabled: false, fails: false, requests: 0 };
  const fetch = async () => {
    state.requests += 1;
    if (state.fails) throw new Error("flags unavailable");
    return state.enabled;
  };
  return { state, fetch };
}

const gate = (fetch: () => Promise<boolean>, cache: MaintenanceCache, namespace = "production.test") =>
  new MaintenanceGate({ fetch, namespace, cache });

describe("maintenance gate", () => {
  it("PostHog evaluation reads the maintenance flag and rejects failure responses", () => {
    expect(KEY).toBe("web-maintenance");
    expect(maintenanceFlagKey(false)).toBe("web-maintenance-development");
    const valid = { flags: { [KEY]: { enabled: true } }, errorsWhileComputingFlags: false };
    expect(parseMaintenanceFlag(valid, KEY)).toBe(true);
    expect(parseMaintenanceFlag({ flags: {} }, KEY)).toBe(false);
    expect(parseMaintenanceFlag({ flags: { [KEY]: { enabled: false } } }, KEY)).toBe(false);
    expect(() => parseMaintenanceFlag({ flags: {}, quotaLimited: ["feature_flags"] }, KEY)).toThrow();
    expect(() => parseMaintenanceFlag({ flags: {}, errorsWhileComputingFlags: true }, KEY)).toThrow();
    expect(parseMaintenanceFlag(valid, maintenanceFlagKey(false))).toBe(false);
  });

  it("a remote disable clears the gate and requests are throttled", async () => {
    const { state, fetch } = stub();
    state.enabled = true;
    const cache: MaintenanceCache = new Map();
    const store = gate(fetch, cache);
    const now = 1_000_000;
    await store.refresh({ now });
    state.enabled = false;
    await store.refresh({ now: now + SECOND });
    expect(store.isInMaintenance(now + SECOND)).toBe(true);
    expect(state.requests).toBe(1);
    await store.refresh({ force: true, now: now + 6 * SECOND });
    expect(store.isInMaintenance(now + 6 * SECOND)).toBe(false);
    expect(gate(fetch, cache).isInMaintenance(now + 6 * SECOND)).toBe(false);
  });

  it("first-launch failure does not block the site", async () => {
    const { state, fetch } = stub();
    state.fails = true;
    const store = gate(fetch, new Map());
    await store.refresh({ now: 1_000_000 });
    expect(store.isInMaintenance(1_000_000)).toBe(false);
    expect(store.refreshFailed).toBe(true);
  });

  it("the maintenance cache survives failure, expires and clears on rollback", async () => {
    const { state, fetch } = stub();
    state.enabled = true;
    const cache: MaintenanceCache = new Map();
    const now = 1_000_000;
    const store = gate(fetch, cache);
    await store.refresh({ now });
    expect(store.isInMaintenance(now)).toBe(true);
    state.fails = true;
    await store.refresh({ force: true, now: now + 6 * SECOND });
    expect(store.isInMaintenance(now + 6 * SECOND)).toBe(true);
    expect(store.refreshFailed).toBe(true);
    expect(gate(fetch, cache).isInMaintenance(now)).toBe(true);
    expect(gate(fetch, cache).isInMaintenance(now + 3601 * SECOND)).toBe(false);
    expect(gate(fetch, cache, "development.test").isInMaintenance(now)).toBe(false);
    state.fails = false;
    state.enabled = false;
    await store.refresh({ force: true, now: now + 12 * SECOND });
    expect(store.isInMaintenance(now + 12 * SECOND)).toBe(false);
    expect(gate(fetch, cache).isInMaintenance(now)).toBe(false);
  });
});
