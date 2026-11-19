"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";

import { motionDuration, motionEasing, prefersReducedMotion } from "./tokens";

/** The line drawn in from the left (`line-draw` in motion.css): a wipe, since non-scaling strokes ignore dash offsets. */
const DRAW: Keyframe[] = [{ clipPath: "inset(-25% 100% -25% -25%)" }, { clipPath: "inset(-25% -25% -25% -25%)" }];
const FADE_IN: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
const FADE_OUT: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];

/**
 * A chart's series arriving and changing (`PriceChart`, `SimulationChart`, the index chart). `plot` is the SVG group
 * that draws the series (grid, area, line, end dots); `ghost` an empty group React never renders into, laid over it.
 *
 * - `draw`: the chart mounted after hydration (a client navigation, data that arrived): the line wipes in from the
 *   left once. A server-rendered chart is simply there; one that comes back after a loading state draws in.
 * - `series` changes (another range, a new scenario): the outgoing series is copied into `ghost` and fades out while
 *   the new one fades in, so the line cross-fades instead of snapping. A change mid-fade starts from what is drawn.
 *
 * Reduced motion: no wipe; the cross-fade stays (a fade). Web Animations only: nothing stays applied.
 */
export function useChartMotion(plot: RefObject<SVGGElement | null>, ghost: RefObject<SVGGElement | null>, series: unknown, { draw }: { draw: boolean }) {
  const drawn = useRef<Node | null>(null);
  const fading = useRef<Animation[]>([]);
  const owner = useRef<SVGGElement | null>(null);

  useLayoutEffect(() => {
    const group = plot.current;
    const layer = ghost.current;
    if (!group || !layer || typeof group.animate !== "function") return;
    const outgoing = drawn.current;
    drawn.current = group.cloneNode(true);
    const reduced = prefersReducedMotion();

    // A group drawn for the first time (the chart mounted, or came back after a loading state) draws in.
    if (owner.current !== group) {
      const firstEver = owner.current === null;
      owner.current = group;
      if ((draw || !firstEver) && !reduced) group.animate(DRAW, { duration: motionDuration("slow"), easing: motionEasing("emphasized") });
      return;
    }
    for (const animation of fading.current) animation.cancel();
    layer.replaceChildren();
    if (!outgoing) return;
    const copy = outgoing as SVGGElement;
    copy.removeAttribute("id");
    copy.setAttribute("aria-hidden", "true");
    layer.append(copy);
    const out = copy.animate(FADE_OUT, { duration: motionDuration("fast"), easing: motionEasing("exit"), fill: "forwards" });
    out.finished.then(() => copy.remove(), () => copy.remove());
    const into = group.animate(FADE_IN, { duration: motionDuration("base"), easing: motionEasing("standard") });
    fading.current = [out, into];
    // `series` is the trigger; the refs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  useLayoutEffect(
    () => () => {
      for (const animation of fading.current) animation.cancel();
    },
    [],
  );
}
