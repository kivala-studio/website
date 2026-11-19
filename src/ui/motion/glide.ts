/*
 * Geometry of a glide (FLIP): an element drawn at its new box is first transformed over its old box, then released
 * to `none`. Pure functions, shared by `useSlidingIndicator` and unit-tested on their own.
 */

export type Box = { left: number; top: number; width: number; height: number };

/** Translation and scale (origin top left) that put a box drawn at `to` over `from`. */
export type Delta = { dx: number; dy: number; sx: number; sy: number };

export const boxOf = (element: Element): Box => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
};

export function deltaBetween(from: Box, to: Box): Delta {
  return {
    dx: from.left - to.left,
    dy: from.top - to.top,
    sx: to.width ? from.width / to.width : 1,
    sy: to.height ? from.height / to.height : 1,
  };
}

/** Under half a pixel and half a percent: nothing worth animating. */
export const isNegligible = ({ dx, dy, sx, sy }: Delta) =>
  Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.005 && Math.abs(sy - 1) < 0.005;

/**
 * Where a glide is on screen at `progress` (0–1, eased): the element's own box plus the share of the delta that is
 * left. Lets a new glide start from wherever an interrupted one had got to.
 */
export function boxInFlight(box: Box, delta: Delta, progress: number): Box {
  const rest = 1 - progress;
  return {
    left: box.left + delta.dx * rest,
    top: box.top + delta.dy * rest,
    width: box.width * (delta.sx + (1 - delta.sx) * progress),
    height: box.height * (delta.sy + (1 - delta.sy) * progress),
  };
}

/** Whether two boxes touch (a remembered start must lie on the group it returns to). */
export const overlaps = (a: Box, b: Box) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

/**
 * Keyframes of the glide. `radius` is the drawn corner radius in px: it is counter-scaled so a pill's ends stay round
 * while it stretches.
 */
export function glideKeyframes({ dx, dy, sx, sy }: Delta, radius: number): Keyframe[] {
  const from: Keyframe = { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` };
  const to: Keyframe = { transformOrigin: "0 0", transform: "none" };
  if (radius > 0) {
    from.borderRadius = `${radius / sx}px / ${radius / sy}px`;
    to.borderRadius = `${radius}px`;
  }
  return [from, to];
}
