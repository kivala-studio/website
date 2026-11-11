import { describe, expect, it } from "vitest";

import { groupName, merging, moved, persistableOrder, reordered, restorePosition } from "./watchlist-ordering";

// Ported from iOS WatchlistLogicTests and the ordering cases of WatchlistStoreTests.
describe("watchlist ordering", () => {
  it("respects the saved order and appends watched items it omits", () => {
    expect(reordered(["CCC", "AAA"], ["AAA", "BBB", "CCC"], new Set(["AAA", "BBB", "CCC"]))).toEqual(["CCC", "AAA", "BBB"]);
  });

  it("drops unwatched and repeated ids from a requested order", () => {
    expect(reordered(["BBB", "ZZZ", "BBB"], ["AAA", "BBB"], new Set(["AAA", "BBB"]))).toEqual(["BBB", "AAA"]);
  });

  it("persists only confirmed members, keeping omitted confirmed ones at the end", () => {
    const membership = new Map([["AAA", true], ["BBB", true], ["CCC", false]]);
    expect(persistableOrder(["CCC", "BBB"], ["AAA", "BBB"], membership)).toEqual(["BBB", "AAA"]);
  });

  it("lets a confirmed order lead while newer visible items stay after it", () => {
    expect(merging(["BBB", "AAA"], ["AAA", "CCC", "BBB"], new Map([["AAA", false]]))).toEqual(["BBB", "CCC"]);
  });

  it("restores an item beside its nearest surviving neighbour", () => {
    expect(restorePosition("BBB", ["AAA", "BBB", "CCC"], ["AAA", "CCC"])).toEqual(["AAA", "BBB", "CCC"]);
    expect(restorePosition("CCC", ["AAA", "BBB", "CCC"], ["AAA"])).toEqual(["AAA", "CCC"]);
    expect(restorePosition("AAA", ["AAA", "BBB"], [])).toEqual(["AAA"]);
    expect(restorePosition("DDD", ["AAA"], ["AAA"])).toEqual(["AAA", "DDD"]);
  });

  it("moves an item one step and stops at the ends", () => {
    expect(moved(["AAA", "BBB", "CCC"], "CCC", -1)).toEqual(["AAA", "CCC", "BBB"]);
    expect(moved(["AAA", "BBB"], "AAA", -1)).toEqual(["AAA", "BBB"]);
    expect(moved(["AAA", "BBB"], "BBB", 1)).toEqual(["AAA", "BBB"]);
  });

  it("trims group names, caps them at 40 characters and rejects empty ones", () => {
    expect(groupName("  Bancos  ")).toBe("Bancos");
    expect(groupName("   ")).toBeNull();
    expect(groupName("x".repeat(45))).toHaveLength(40);
  });
});
