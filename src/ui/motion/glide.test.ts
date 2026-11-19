import { describe, expect, it } from "vitest";

import { boxInFlight, deltaBetween, glideKeyframes, isNegligible } from "./glide";

const from = { left: 10, top: 20, width: 100, height: 40 };
const to = { left: 130, top: 20, width: 50, height: 40 };

describe("glide", () => {
  it("puts the new box over the old one, origin top left", () => {
    expect(deltaBetween(from, to)).toEqual({ dx: -120, dy: 0, sx: 2, sy: 1 });
  });

  it("finds where an interrupted glide is", () => {
    const delta = deltaBetween(from, to);
    expect(boxInFlight(to, delta, 0)).toEqual(from);
    expect(boxInFlight(to, delta, 1)).toEqual(to);
    expect(boxInFlight(to, delta, 0.5)).toEqual({ left: 70, top: 20, width: 75, height: 40 });
  });

  it("skips sub-pixel changes", () => {
    expect(isNegligible(deltaBetween(from, { ...from, left: 10.2 }))).toBe(true);
    expect(isNegligible(deltaBetween(from, to))).toBe(false);
  });

  it("counter-scales the corners so a stretched pill stays round", () => {
    const [start, end] = glideKeyframes({ dx: -120, dy: 0, sx: 2, sy: 1 }, 20);
    expect(start).toMatchObject({ transform: "translate(-120px, 0px) scale(2, 1)", borderRadius: "10px / 20px" });
    expect(end).toMatchObject({ transform: "none", borderRadius: "20px" });
  });
});
