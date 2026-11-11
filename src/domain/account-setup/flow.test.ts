import { describe, expect, it } from "vitest";

import { needsAccountSetup, preferredName } from "../auth/account";
import { AccountSetupFlow, type KeyValueStore, SetupPersistence } from "./flow";

// Port of iOS PostLoginOnboardingTests. The rollout instant is 100 as in the iOS fixture.
const ROLLOUT = 100;

function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

const persistence = () => new SetupPersistence(memoryStore());
const offline = () => Object.assign(new TypeError("Failed to fetch"), {});

function needsSetup(store: SetupPersistence, userID: string, createdAt: number, serverCompletion: boolean | null) {
  return needsAccountSetup({
    createdAt,
    serverCompletion,
    hasDraft: store.draft(userID) !== null,
    locallyCompleted: store.isCompleted(userID),
    rolloutAt: ROLLOUT,
  });
}

describe("account setup", () => {
  it("lets existing accounts bypass and resumes new accounts by identity", () => {
    const store = persistence();
    expect(needsSetup(store, "old", 50, null)).toBe(false);
    expect(needsSetup(store, "old", 50, false)).toBe(true);
    expect(needsSetup(store, "new", 150, null)).toBe(true);

    const flow = new AccountSetupFlow("new", "Ana", store);
    flow.update({ name: "Inês", hasEditedName: true, step: "watchlist", selectedIDs: ["BAI"] });
    const restored = new AccountSetupFlow("new", "Provider", store);
    expect(restored.draft).toEqual(flow.draft);
    expect(store.draft("other")).toBeNull();
    expect(needsSetup(store, "other", Number.NEGATIVE_INFINITY, false)).toBe(true);

    store.complete("new");
    expect(needsSetup(store, "new", Date.now(), false)).toBe(false);
    expect(store.draft("new")).toBeNull();
  });

  it("resolves the name with the saved name first and keeps a skipped name neutral", () => {
    expect(preferredName({ investao_display_name: "  李  ", full_name: "Provider" })).toBe("李");
    expect(preferredName({ full_name: "Inês" })).toBe("Inês");
    expect(preferredName({ email: "someone@example.com" })).toBeNull();
    expect(preferredName({ full_name: "Provider", investao_name_skipped: true })).toBeNull();
    expect(preferredName({ investao_display_name: "Ana", investao_name_skipped: true })).toBe("Ana");
  });

  it("keeps an optional Unicode name, going back and a late provider name without losing edits", async () => {
    const flow = new AccountSetupFlow("user", "Provider", persistence());
    flow.editName("  É 李  ");
    flow.refreshInitialName("New provider");
    let saved: string | null | undefined;
    await flow.advanceName(false, () => true, async (name) => void (saved = name));
    expect(saved).toBe("É 李");
    expect(flow.draft.step).toBe("watchlist");
    flow.back();
    expect(flow.draft.name).toBe("É 李");
    await flow.advanceName(true, () => true, async (name) => expect(name).toBeNull());
    expect(flow.draft.skippedName).toBe(true);
    expect(flow.draft.step).toBe("watchlist");
  });

  it("retries only the membership a partial save did not confirm", async () => {
    const flow = new AccountSetupFlow("user", null, persistence());
    flow.update({ selectedIDs: ["A", "B"] });
    let completions = 0;
    await flow.finish(
      false,
      () => true,
      async (ids) => {
        expect(ids).toEqual(["A", "B"]);
        return ["A"];
      },
      async () => void (completions += 1),
    );
    expect(flow.draft.selectedIDs).toEqual(["B"]);
    expect(flow.getSnapshot().hasWatchlistFailure).toBe(true);
    expect(flow.getSnapshot().errorKey).toBe("onboarding.error.partialSave");
    expect(flow.getSnapshot().isCompleted).toBe(false);
    expect(completions).toBe(0);

    await flow.finish(
      false,
      () => true,
      async (ids) => {
        expect(ids).toEqual(["B"]);
        return ids;
      },
      async () => void (completions += 1),
    );
    expect(flow.getSnapshot().isCompleted).toBe(true);
    expect(completions).toBe(1);

    await flow.finish(
      false,
      () => true,
      async () => expect.fail("Duplicate save"),
      async () => expect.fail("Duplicate completion"),
    );
  });

  it("never claims unsaved selections after a failed completion or an explicit skip", async () => {
    const flow = new AccountSetupFlow("user", null, persistence());
    flow.update({ selectedIDs: ["A"] });
    await flow.finish(
      true,
      () => true,
      async () => expect.fail("Skip writes watchlist"),
      async () => {
        throw offline();
      },
    );
    expect(flow.getSnapshot().isCompleted).toBe(false);
    expect(flow.getSnapshot().errorKey).toBe("errors.network.checkConnection");
    await flow.finish(
      true,
      () => true,
      async () => expect.fail("Skip writes watchlist"),
      async () => {},
    );
    expect(flow.getSnapshot().isCompleted).toBe(true);
  });

  it("ignores a late response for another account and a duplicate tap", async () => {
    const flow = new AccountSetupFlow("user", "Ana", persistence());
    let current = true;
    await flow.advanceName(false, () => current, async () => {
      await flow.advanceName(false, () => current, async () => expect.fail("Duplicate name write"));
      current = false;
    });
    expect(flow.draft.step).toBe("name");
    expect(flow.getSnapshot().errorKey).toBeNull();

    current = true;
    flow.update({ selectedIDs: ["A"] });
    await flow.finish(
      false,
      () => current,
      async (ids) => {
        current = false;
        return ids;
      },
      async () => expect.fail("Old account completed"),
    );
    expect(flow.getSnapshot().isCompleted).toBe(false);
    expect(flow.draft.selectedIDs).toEqual(["A"]);
  });
});
