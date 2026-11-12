import { describe, expect, it } from "vitest";

import { orderWhileHidden, parsePrivacyMode, privacyCookie } from "@/domain/privacy/privacy";

import { PrivacyModeStore } from "./privacy-store";

describe("PrivacyModeStore", () => {
  it("is off by default, saves before notifying and ignores the value it already has", () => {
    let saved: string | undefined;
    const persist = (enabled: boolean) => {
      saved = privacyCookie(enabled, true).split(";")[0].split("=")[1];
    };
    const store = new PrivacyModeStore(parsePrivacyMode(saved), persist);
    let notified = 0;
    store.subscribe(() => {
      expect(saved).toBeDefined();
      notified += 1;
    });
    expect(store.getSnapshot()).toBe(false);
    store.set(true);
    expect(new PrivacyModeStore(parsePrivacyMode(saved), persist).getSnapshot()).toBe(true);
    store.set(true);
    expect(notified).toBe(1);
    store.set(false);
    expect(new PrivacyModeStore(parsePrivacyMode(saved), persist).getSnapshot()).toBe(false);
    expect(notified).toBe(2);
  });

  it("the cookie lasts a year on every path, and turning off removes it", () => {
    expect(privacyCookie(true, true)).toBe("investao-privacy=on; max-age=31536000; path=/; samesite=lax; secure");
    expect(privacyCookie(false, false)).toBe("investao-privacy=; max-age=0; path=/; samesite=lax");
  });

  it("hidden rows sort by id, so their order says nothing about size", () => {
    const rows = [{ id: "c", value: 300 }, { id: "a", value: 100 }, { id: "b", value: 200 }];
    expect(orderWhileHidden(rows, true).map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(orderWhileHidden(rows, false)).toBe(rows);
  });
});
