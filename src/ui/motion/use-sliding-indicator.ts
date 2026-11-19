"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";

import { type Box, boxInFlight, boxOf, type Delta, deltaBetween, glideKeyframes, isNegligible, overlaps } from "./glide";
import { motionDuration, motionEasing, prefersReducedMotion } from "./tokens";

type Options = {
  /** Finds the selected item inside the container: `[aria-selected="true"]`, `[aria-current]`, `[aria-checked="true"]`. */
  selector: string;
  /** The pseudo-element of the selected item that draws the indicator (its fill or underline). */
  pseudo?: "::before" | "::after";
  /**
   * A name for the group, so the indicator also glides when the whole group is rendered again: page-level tabs that a
   * route change unmounts and mounts. The last position is kept for a moment, in page coordinates.
   */
  memory?: string;
};

type Flight = { animation: Animation; element: HTMLElement; delta: Delta };

/** Positions of remembered groups as they unmounted, in page coordinates. */
const remembered = new Map<string, { box: Box; at: number }>();
const MEMORY_MS = 1200;

const supportsPseudoAnimation = () => typeof KeyframeEffect !== "undefined" && "pseudoElement" in KeyframeEffect.prototype;

function cornerRadius(element: Element, pseudo: string, box: Box) {
  const radius = parseFloat(getComputedStyle(element, pseudo).borderTopLeftRadius) || 0;
  return Math.min(radius, box.height / 2, box.width / 2);
}

function progressOf(animation: Animation) {
  const progress = animation.effect?.getComputedTiming().progress;
  return typeof progress === "number" ? progress : 1;
}

/**
 * Glides a selection indicator from the item that was selected to the one that is now (segmented thumbs, tab
 * underlines, nav pills). The selected item draws the indicator itself with a pseudo-element, so the markup is right
 * without JavaScript, on the server and after a resize; on a change, this animates the new item's pseudo-element from
 * the old one's box with the Web Animations API (no inline styles). A change mid-glide starts from where the
 * indicator is, so rapid clicks never jump. Reduced motion, or a browser that can't animate a pseudo-element, gets
 * the instant change.
 *
 * `selection` is anything that changes with the selection (the value, the index, the pathname). Attach the returned
 * ref to the element that contains the items.
 */
export function useSlidingIndicator<T extends HTMLElement>(
  selection: unknown,
  { selector, pseudo = "::before", memory }: Options,
): RefObject<T | null> {
  const container = useRef<T>(null);
  const previous = useRef<HTMLElement | null>(null);
  const flight = useRef<Flight | null>(null);

  useLayoutEffect(() => {
    const root = container.current;
    const next = root?.querySelector<HTMLElement>(selector) ?? null;
    const before = previous.current;
    previous.current = next;
    if (!root || !next || next === before) return;

    let from: Box | null = null;
    let fromMemory = false;
    const running = flight.current;
    if (running && running.animation.playState === "running" && running.element.isConnected) {
      from = boxInFlight(boxOf(running.element), running.delta, progressOf(running.animation));
    } else if (before?.isConnected) {
      from = boxOf(before);
    } else if (!before && memory) {
      const kept = remembered.get(memory);
      if (kept && performance.now() - kept.at < MEMORY_MS) {
        from = { ...kept.box, left: kept.box.left - window.scrollX, top: kept.box.top - window.scrollY };
        fromMemory = true;
      }
    }
    running?.animation.cancel();
    flight.current = null;
    if (!from || prefersReducedMotion() || !supportsPseudoAnimation()) return;

    const to = boxOf(next);
    if (!to.width || !to.height || !from.width || !from.height) return;
    if (fromMemory && !overlaps(from, boxOf(root))) return;
    const delta = deltaBetween(from, to);
    if (isNegligible(delta)) return;

    const animation = next.animate(glideKeyframes(delta, cornerRadius(next, pseudo, to)), {
      duration: motionDuration("base"),
      easing: motionEasing("emphasized"),
      pseudoElement: pseudo,
    });
    flight.current = { animation, element: next, delta };
  }, [selection, selector, pseudo, memory]);

  // Remember where the indicator was when the group goes away (a route change), in page coordinates.
  useLayoutEffect(() => {
    if (!memory) return;
    return () => {
      const selected = previous.current;
      if (!selected?.isConnected) return;
      const box = boxOf(selected);
      if (!box.width) return;
      remembered.set(memory, { box: { ...box, left: box.left + window.scrollX, top: box.top + window.scrollY }, at: performance.now() });
    };
  }, [memory]);

  return container;
}
