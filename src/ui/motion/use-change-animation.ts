"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";

import { motionColour, type MotionDuration, motionDuration, type MotionEasing, motionEasing, prefersReducedMotion } from "./tokens";

export type ChangeAnimation = {
  keyframes: Keyframe[];
  duration?: MotionDuration;
  easing?: MotionEasing;
  /** Keyframes that replace these with reduced motion (a fade); none means no animation. */
  reduced?: Keyframe[];
};

/**
 * Plays an animation on `ref` when `value` changes: not on mount, not on hydration, not when a hidden ancestor is
 * shown again and not on a re-render with the same value. `animation` may depend on the previous and next values
 * (a value rolls up when it rises, down when it falls). Uses the Web Animations API, so nothing stays applied.
 */
export function useChangeAnimation<T>(
  ref: RefObject<Element | null>,
  value: T,
  animation: ChangeAnimation | ((previous: T, next: T) => ChangeAnimation | ChangeAnimation[] | null),
  isSame: (a: T, b: T) => boolean = Object.is,
  /** Starts the animation; `playLive` (`./live`) for figures a poll changes. Default: at once. */
  schedule: (play: () => void) => void = (play) => play(),
) {
  const previous = useRef(value);
  const playing = useRef<Animation[]>([]);
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = value;
    const element = ref.current;
    if (!element || isSame(before, value) || typeof element.animate !== "function") return;
    const result = typeof animation === "function" ? animation(before, value) : animation;
    if (!result) return;
    const specs = Array.isArray(result) ? result : [result];
    const reduced = prefersReducedMotion();
    for (const running of playing.current) running.cancel();
    playing.current = [];
    schedule(() => {
      for (const running of playing.current) running.cancel();
      playing.current = specs.flatMap((spec) => {
        const keyframes = reduced ? spec.reduced : spec.keyframes;
        if (!keyframes) return [];
        return [element.animate(keyframes, { duration: motionDuration(spec.duration ?? "base"), easing: motionEasing(spec.easing ?? "emphasized") })];
      });
    });
    // `animation` and `isSame` are read when the value changes; a new function identity alone is no change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ref]);
}

/** A figure rolling in from below when it rises, from above when it falls, and just fading when it only changed. */
export function valueRoll(direction: number): ChangeAnimation {
  const offset = direction > 0 ? "0.35em" : direction < 0 ? "-0.35em" : "0";
  return {
    keyframes: [{ opacity: 0, transform: `translateY(${offset})` }, { opacity: 1, transform: "none" }],
    duration: "base",
    easing: "emphasized",
    reduced: [{ opacity: 0.4 }, { opacity: 1 }],
  };
}

/**
 * A live figure's direction, as a tint behind it that fades out (`flash`): positive when it rose, negative when it
 * fell. Colour only, so reduced motion keeps it. The tint reaches past the text by a box shadow, so nothing moves.
 */
export function valueFlash(direction: number): ChangeAnimation | null {
  if (direction === 0) return null;
  const colour = motionColour(direction > 0 ? "positive" : "negative");
  if (!colour) return null;
  const tint = `color-mix(in srgb, ${colour} 16%, transparent)`;
  const clear = `color-mix(in srgb, ${colour} 0%, transparent)`;
  const keyframes: Keyframe[] = [
    { backgroundColor: tint, boxShadow: `0 0 0 0.2em ${tint}`, borderRadius: "0.2em" },
    { backgroundColor: clear, boxShadow: `0 0 0 0.2em ${clear}`, borderRadius: "0.2em" },
  ];
  return { keyframes, reduced: keyframes, duration: "flash", easing: "standard" };
}

/**
 * A bar's fill growing or shrinking from its previous length (`before` and `after` in any one unit): the new bar is
 * scaled back to the old length along x, then released. Set the transform origin on the bar (the edge it grows from).
 * Movement, so reduced motion changes it at once.
 */
export function barGrow(before: number, after: number): ChangeAnimation | null {
  if (!(after > 0) || !Number.isFinite(before) || before === after) return null;
  return { keyframes: [{ transform: `scaleX(${Math.max(before, 0) / after})` }, { transform: "none" }], duration: "slow", easing: "emphasized" };
}

/**
 * The next step of a flow coming in from the side it is on: from the right going forward, from the left going back
 * (`direction` 1 or −1), with a fade. Reduced motion: the fade only.
 */
export function stepSlide(direction: number): ChangeAnimation {
  const offset = direction < 0 ? "-1.5rem" : "1.5rem";
  return {
    keyframes: [{ opacity: 0, transform: `translateX(${offset})` }, { opacity: 1, transform: "none" }],
    reduced: [{ opacity: 0 }, { opacity: 1 }],
    duration: "slow",
    easing: "emphasized",
  };
}

/** Content that was replaced in place (a chart's axis, a panel's body) fading in. A fade, so reduced motion keeps it. */
export const FADE_IN: ChangeAnimation = {
  keyframes: [{ opacity: 0 }, { opacity: 1 }],
  reduced: [{ opacity: 0 }, { opacity: 1 }],
  duration: "base",
  easing: "standard",
};

/** A swapped icon growing in. */
export const ICON_IN: ChangeAnimation = {
  keyframes: [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "none" }],
  duration: "base",
  easing: "emphasized",
  reduced: [{ opacity: 0 }, { opacity: 1 }],
};
