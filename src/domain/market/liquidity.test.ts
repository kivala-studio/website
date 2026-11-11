import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { liquidityProfile } from "./liquidity";
import { DAY_MS, parseInstant } from "./zone";

// LiquidityProfileTests
describe("liquidity profile", () => {
  it("counts quiet sessions as zero", () => {
    const now = parseInstant("2026-11-06T18:00:00+01:00")!;
    const sessions = Array.from({ length: 20 }, (_, offset) => now - offset * DAY_MS);
    // Five traded sessions of 100 units at 50 Kz across a 20-session window.
    const history = sessions.slice(0, 5).map((date) => ({ date, value: new Decimal(50), volume: new Decimal(100) }));
    const profile = liquidityProfile({
      history,
      sessionDates: sessions,
      priceScale: new Decimal(1),
      heldQuantity: new Decimal(120),
      now,
    });
    expect(profile).toBeDefined();
    expect(profile!.sessions).toBe(20);
    expect(profile!.tradedSessions).toBe(5);
    expect(profile!.averageDailyVolume.toString()).toBe("25");
    expect(profile!.averageDailyValue.toString()).toBe("1250");
    expect(profile!.sessionsToExit).toBe(5);
  });
});
