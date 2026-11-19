"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";

import { type MotionDuration, motionDuration, type MotionEasing, motionEasing, prefersReducedMotion } from "./tokens";

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
  animation: ChangeAnimation | ((previous: T, next: T) => ChangeAnimation | null),
  isSame: (a: T, b: T) => boolean = Object.is,
) {
  const previous = useRef(value);
  const playing = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = value;
    const element = ref.current;
    if (!element || isSame(before, value) || typeof element.animate !== "function") return;
    const spec = typeof animation === "function" ? animation(before, value) : animation;
    if (!spec) return;
    const keyframes = prefersReducedMotion() ? spec.reduced : spec.keyframes;
    if (!keyframes) return;
    playing.current?.cancel();
    playing.current = element.animate(keyframes, {
      duration: motionDuration(spec.duration ?? "base"),
      easing: motionEasing(spec.easing ?? "emphasized"),
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

/** A swapped icon growing in. */
export const ICON_IN: ChangeAnimation = {
  keyframes: [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "none" }],
  duration: "base",
  easing: "emphasized",
  reduced: [{ opacity: 0 }, { opacity: 1 }],
};
