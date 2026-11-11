import { describe, expect, it } from "vitest";

import { ChartScrubPacer, nearestIndex } from "./selection";

// Ports ChartScrubbingTests.swift case for case (times in seconds, as on iOS).
describe("chart scrubbing", () => {
  it("dense series lookup is logarithmic and keeps real observations", () => {
    let reads = 0;
    const index = nearestIndex(100_000, 51_234.6, (offset) => {
      reads += 1;
      return offset;
    });
    expect(index).toBe(51_235);
    expect(reads).toBeLessThanOrEqual(20);
    expect(nearestIndex(3, 15, (offset) => offset * 10)).toBe(1);
    expect(nearestIndex(0, 0, () => 0)).toBeUndefined();
  });

  it("lookup clamps to endpoints and handles a single observation", () => {
    for (const [time, expected] of [
      [-10, 0],
      [100, 2],
      [10, 1],
    ]) {
      expect(nearestIndex(3, time, (offset) => offset * 10)).toBe(expected);
    }
    expect(nearestIndex(1, 100, () => 0)).toBe(0);
  });

  it("rapid dragging bounds feedback without queuing or delaying the next gesture", () => {
    const pacer = new ChartScrubPacer();
    let selections = 0;
    let vibrations = 0;
    for (let tick = 0; tick < 1_000; tick += 1) {
      const time = tick / 1_000;
      if (pacer.allowsSelection(time)) {
        selections += 1;
        if (pacer.allowsFeedback(time)) vibrations += 1;
      }
    }
    expect(selections).toBeGreaterThan(20);
    expect(selections).toBeLessThanOrEqual(30);
    expect(vibrations).toBeGreaterThan(5);
    expect(vibrations).toBeLessThanOrEqual(10);
    pacer.endGesture();
    expect(pacer.allowsSelection(1.0)).toBe(true);
    expect(pacer.allowsFeedback(2.0)).toBe(true);
    pacer.endGesture();
    expect(pacer.allowsFeedback(2.01)).toBe(false);
  });
});
