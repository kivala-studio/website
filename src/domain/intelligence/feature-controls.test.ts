import { describe, expect, it } from "vitest";

import fixture from "../../../tests/fixtures/intelligence-feature-config.example.json";
import {
  FeatureControlStore,
  INTELLIGENCE_FEATURES,
  type IntelligenceFeature,
  type KeyValueStorage,
  allows,
  decodeFeatureConfiguration,
  intelligenceAudience,
  permitsInsightType,
  personalizationVersion,
  resolveAvailability,
  rolloutBucket,
} from "./feature-controls";

/* Port of Tests/MarketDiscoveryTests/IntelligenceFeatureControlTests.swift. The engine, personalisation and wrap
 * archive cases live beside those modules; the Home fallback case is in home-context.test.ts. */

const now = Date.parse("2026-09-28T12:00:00Z");
type Doc = Record<string, unknown>;

function document(version = 1): Doc {
  const features = Object.fromEntries(
    INTELLIGENCE_FEATURES.map((feature) => [
      feature,
      {
        enabled: feature !== "personalization_v2",
        kill_switch: false,
        rollout_percentage: 100,
        rollout_salt: "phase19",
        audiences: ["production", "beta", "internal"],
      },
    ]),
  );
  return { schema_version: 1, version, minimum_app_build: 0, effective_at: "2026-09-28T11:00:00Z", expires_at: "2026-09-29T12:00:00Z", features };
}

const data = (doc: Doc) => JSON.stringify(doc);
const configuration = (doc: Doc) => decodeFeatureConfiguration(data(doc));
function changing(doc: Doc, feature: IntelligenceFeature, key: string, value: unknown): Doc {
  const features = { ...(doc.features as Record<string, Doc>) };
  features[feature] = { ...features[feature], [key]: value };
  return { ...doc, features };
}
const resolve = (doc: Doc | null, at = now, identity = "fixture-install") =>
  resolveAvailability({ configuration: doc ? configuration(doc) : null, identity, audience: "production", appBuild: 10, now: at });

describe("intelligence feature controls", () => {
  it("applies enable, disable and kill precedence", () => {
    expect(allows(resolve(document()), "weekly_wrap")).toBe(true);
    expect(allows(resolve(changing(document(), "weekly_wrap", "enabled", false)), "weekly_wrap")).toBe(false);
    const killed = resolve(changing(document(), "weekly_wrap", "kill_switch", true));
    expect(allows(killed, "weekly_wrap")).toBe(false);
    expect(killed.decisions.weekly_wrap.reason).toBe("killed");
    expect(allows(killed, "week_ahead")).toBe(true);
  });

  it("keeps core facts and the Weekly Wrap on without a document", () => {
    const defaults = resolve(null);
    for (const feature of ["insight_engine", "price_changes", "weekly_wrap"] as const) expect(allows(defaults, feature)).toBe(true);
    for (const feature of ["saturday_discover", "week_ahead", "intelligence_notifications", "personalization_v2"] as const)
      expect(allows(defaults, feature)).toBe(false);
  });

  it("never bypasses dependencies", () => {
    for (const dependency of ["insight_engine", "snapshot_capture"] as const) {
      expect(allows(resolve(changing(document(), dependency, "kill_switch", true)), "weekly_wrap")).toBe(false);
    }
    const result = resolve(changing(document(), "personalization_engine", "enabled", false));
    expect(allows(result, "saturday_discover")).toBe(false);
    expect(allows(result, "personalized_home")).toBe(false);
    expect(personalizationVersion(result)).toBe("significance");
    expect(allows(resolve(changing(document(), "market_events", "enabled", false)), "week_ahead")).toBe(false);
  });

  it("rejects malformed, missing, unknown and unsupported fields", () => {
    const mutations: Doc[] = [];
    for (const key of Object.keys(document())) {
      const bad = document();
      delete bad[key];
      mutations.push(bad);
    }
    mutations.push({ ...document(), surprise: true });
    mutations.push({ ...document(), schema_version: 2 });
    mutations.push({ ...document(), effective_at: "not-a-date" });
    mutations.push({ ...document(), effective_at: "2026-02-30T11:00:00Z" });
    mutations.push({ ...document(), expires_at: "2026-09-27T12:00:00Z" });
    mutations.push({ ...document(), expires_at: "2027-09-27T12:00:00Z" });
    mutations.push({ ...document(), version: -1 });
    const omitted = document();
    const rules = { ...(omitted.features as Record<string, unknown>) };
    delete rules.weekly_wrap;
    mutations.push({ ...omitted, features: rules });
    for (const percentage of [-1, 101, 12.5]) mutations.push(changing(document(), "weekly_wrap", "rollout_percentage", percentage));
    mutations.push(changing(document(), "weekly_wrap", "unknown", true));
    mutations.push(changing(document(), "weekly_wrap", "audiences", ["unexpected"]));
    mutations.push(changing(document(), "weekly_wrap", "audiences", ["beta", "beta"]));
    mutations.push(changing(document(), "weekly_wrap", "rollout_salt", "private data!"));
    for (const bad of mutations) expect(() => configuration(bad)).toThrow();
    expect(() => decodeFeatureConfiguration("{")).toThrow();
  });

  it("keeps stable nested percentage cohorts and the shared bucket fixture", () => {
    const zero = changing(document(), "weekly_wrap", "rollout_percentage", 0);
    const full = changing(document(), "weekly_wrap", "rollout_percentage", 100);
    const small = changing(document(), "weekly_wrap", "rollout_percentage", 20);
    const large = changing(document(), "weekly_wrap", "rollout_percentage", 40);
    let included = 0;
    for (let index = 0; index < 100; index++) {
      const identity = `fixture-${index}`;
      expect(allows(resolve(zero, now, identity), "weekly_wrap")).toBe(false);
      expect(allows(resolve(full, now, identity), "weekly_wrap")).toBe(true);
      const first = allows(resolve(small, now, identity), "weekly_wrap");
      expect(allows(resolve(small, now, identity), "weekly_wrap")).toBe(first);
      if (first) {
        included++;
        expect(allows(resolve(large, now, identity), "weekly_wrap")).toBe(true);
      }
    }
    expect(included).toBeGreaterThan(0);
    expect(included).toBeLessThan(100);
    expect(rolloutBucket("fixture-install", "weekly_wrap", "phase19")).toBe(8065);
  });

  it("keeps kills from a stale document and turns notifications and experiments off", () => {
    let killed = changing(document(), "price_changes", "kill_switch", true);
    killed = changing(killed, "personalization_v2", "enabled", true);
    const stale = resolve(killed, now + 2 * 86_400_000);
    expect(stale.trusted).toBe(false);
    for (const feature of ["price_changes", "notification_watchlist", "intelligence_notifications", "personalization_v2"] as const)
      expect(allows(stale, feature)).toBe(false);
    expect(allows(stale, "weekly_wrap")).toBe(true);
  });

  it("keeps personalisation versions and generator controls independent", () => {
    expect(personalizationVersion(resolve(document()))).toBe("v1");
    expect(personalizationVersion(resolve(changing(document(), "personalization_v2", "enabled", true)))).toBe("v2");
    const result = resolve(changing(document(), "portfolio_allocation", "kill_switch", true));
    expect(permitsInsightType(result, "portfolioAllocation")).toBe(false);
    expect(permitsInsightType(result, "portfolioPricePerformance")).toBe(true);
    expect(permitsInsightType(result, "watchlistMovement")).toBe(true);
  });

  it("gates notifications on trust and category", () => {
    const untrusted = resolveAvailability({
      configuration: configuration(document()),
      identity: "fixture",
      audience: "production",
      appBuild: 10,
      now,
      notificationsTrusted: false,
    });
    expect(allows(untrusted, "notification_movement")).toBe(false);
    expect(allows(untrusted, "notification_market_recap")).toBe(false);
    const category = resolve(changing(document(), "notification_movement", "enabled", false));
    expect(allows(category, "notification_movement")).toBe(false);
    expect(allows(category, "notification_market_recap")).toBe(true);
  });

  it("decodes the shared example document", () => {
    const decoded = decodeFeatureConfiguration(JSON.stringify(fixture));
    expect(decoded.version).toBe(1);
    expect(Object.keys(decoded.features).sort()).toEqual([...INTELLIGENCE_FEATURES].sort());
  });

  it("derives the audience from the deployment", () => {
    expect(intelligenceAudience("production", "production")).toBe("production");
    expect(intelligenceAudience("production", undefined)).toBe("production");
    expect(intelligenceAudience("production", "preview")).toBe("internal");
    expect(intelligenceAudience("demo", undefined)).toBe("internal");
    expect(intelligenceAudience("local", undefined)).toBe("internal");
  });
});

class MemoryStorage implements KeyValueStorage {
  values = new Map<string, string>();
  getItem = (key: string) => this.values.get(key) ?? null;
  setItem = (key: string, value: string) => void this.values.set(key, value);
}

function repository(initial: unknown) {
  const state = { payload: initial, calls: 0, fails: false };
  return {
    state,
    fetch: async () => {
      state.calls++;
      if (state.fails) throw new Error("offline");
      return state.payload;
    },
  };
}

const store = (repo: ReturnType<typeof repository>, storage: KeyValueStorage, at = now) =>
  new FeatureControlStore({
    fetch: repo.fetch,
    storage,
    audience: "production",
    appBuild: 10,
    now: at,
    randomID: () => "6f9619ff-8b86-4011-b42d-00c04fc964ff",
  });

describe("feature control store", () => {
  it("keeps the last valid cache across a malformed fetch and a version rollback", async () => {
    const storage = new MemoryStorage();
    const repo = repository(document(2));
    const subject = store(repo, storage);
    await subject.refresh(now);
    expect(subject.availability(now).configurationVersion).toBe(2);
    repo.state.payload = "{";
    await subject.refresh(now + 1000, true);
    expect(subject.validationFailed).toBe(true);
    expect(subject.availability(now).configurationVersion).toBe(2);
    expect(allows(subject.availability(now), "intelligence_notifications")).toBe(false);
    repo.state.payload = document(1);
    await subject.refresh(now + 2000, true);
    expect(subject.validationFailed).toBe(true);
    repo.state.payload = changing(document(2), "weekly_wrap", "kill_switch", true);
    await subject.refresh(now + 3000, true);
    expect(subject.validationFailed).toBe(true);
    expect(allows(subject.availability(now), "weekly_wrap")).toBe(true);
    const restored = store(repo, storage, now + 3000);
    expect(restored.availability(now).configurationVersion).toBe(2);
    expect(allows(restored.availability(now), "weekly_wrap")).toBe(true);
    expect(allows(restored.availability(now), "intelligence_notifications")).toBe(false);
  });

  it("honours the refresh interval and rejects a build it cannot serve", async () => {
    const storage = new MemoryStorage();
    const repo = repository(document());
    const subject = store(repo, storage);
    await subject.refresh(now);
    await subject.refresh(now + 10_000);
    expect(repo.state.calls).toBe(1);
    repo.state.payload = { ...document(2), minimum_app_build: 11 };
    await subject.refresh(now + 11_000, true);
    expect(subject.validationFailed).toBe(true);
    expect(subject.availability(now).configurationVersion).toBe(1);
  });

  it("never forgets known kills after a network failure or with a stale cache", async () => {
    const storage = new MemoryStorage();
    const repo = repository(changing(document(), "portfolio_allocation", "kill_switch", true));
    const subject = store(repo, storage);
    await subject.refresh(now);
    repo.state.fails = true;
    await subject.refresh(now + 10_000, true);
    expect(subject.fetchFailed).toBe(true);
    expect(permitsInsightType(subject.availability(now + 10_000), "portfolioAllocation")).toBe(false);
    const later = now + 3 * 86_400_000;
    const restored = store(repo, storage, later);
    expect(permitsInsightType(restored.availability(later), "portfolioAllocation")).toBe(false);
    expect(allows(restored.availability(later), "weekly_wrap")).toBe(true);
  });

  it("keeps one install identity per browser", () => {
    const storage = new MemoryStorage();
    store(repository(null), storage);
    expect(storage.getItem("intelligence-rollout-installation-v1")).toBe("6f9619ff-8b86-4011-b42d-00c04fc964ff");
  });
});
