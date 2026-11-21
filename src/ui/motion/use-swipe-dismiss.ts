"use client";

import { type MouseEvent, type PointerEvent, type RefObject, useRef } from "react";

import { motionDuration, motionEasing, prefersReducedMotion } from "./tokens";

/** Movement before a press becomes a swipe (or is left to the browser, sideways); under it, a press stays a tap. */
const SLOP = 6;
/** How far up a release dismisses, in px. */
const DISTANCE = 48;
/** How fast up a release dismisses however short the swipe, in px/ms. */
const VELOCITY = 0.11;
/** The span of the last moves that measures the release speed, in ms. */
const SAMPLE_MS = 80;

/** Pulled down, away from its edge, it gives a little and stops: at most 24 px. */
const damp = (offset: number) => (offset * 24) / (offset + 48);
const at = (offset: number) => ({ transform: `translateY(${offset}px)` });

type Gesture = {
  pointer: number;
  x: number;
  y: number;
  /** Where the element was when it was caught (mid-settle), so it never jumps. */
  from: number;
  offset: number;
  dragging: boolean;
  samples: { time: number; offset: number }[];
};

/**
 * Swipe up to dismiss an element anchored to the top (a toast). Spread the returned handlers on it and give it
 * `touch-action: pan-x` (`touch-pan-x`), so a sideways move stays the browser's. The element follows the pointer 1:1
 * upwards and gives a little downwards; a release past 48 px or faster than 0.11 px/ms sends it off the top
 * (`onDismiss(true)`: it has already left), any other release settles it back, and it can be caught again mid-way.
 * Only the first pointer counts. A press that does not move is left alone, so the buttons inside still take taps.
 * It moves through the Web Animations API on `transform`, so it adds to a CSS `translate` and sets no inline style.
 * With reduced motion it does not follow: a swipe up still dismisses, with the element's own exit (`onDismiss(false)`).
 */
export function useSwipeDismiss<T extends HTMLElement>(
  ref: RefObject<T | null>,
  { onDismiss, onDrag }: { onDismiss: (swiped: boolean) => void; onDrag?: (dragging: boolean) => void },
) {
  const gesture = useRef<Gesture | null>(null);
  const motion = useRef<Animation | null>(null);
  const done = useRef(false);
  /** A swipe happened since the last press: the click it ends with is not a tap. */
  const swiped = useRef(false);

  /** Holds the element at `offset` (a paused animation whose keyframes follow the pointer). */
  const hold = (element: T, offset: number) => {
    const frames = [at(offset), at(offset)];
    const effect = motion.current?.effect;
    if (motion.current?.playState === "paused" && effect instanceof KeyframeEffect) {
      effect.setKeyframes(frames);
      return;
    }
    motion.current?.cancel();
    motion.current = element.animate(frames, { duration: 1, fill: "forwards" });
    motion.current.pause();
  };

  const release = (element: T, event: PointerEvent<T> | null) => {
    const now = gesture.current;
    gesture.current = null;
    if (!now?.dragging) return;
    const reduced = prefersReducedMotion();
    const shown = reduced ? 0 : now.offset < 0 ? now.offset : damp(now.offset);
    const first = now.samples.find((sample) => sample.time >= now.samples[now.samples.length - 1].time - SAMPLE_MS) ?? now.samples[0];
    const last = now.samples[now.samples.length - 1];
    const velocity = last && first && last.time > first.time ? (last.offset - first.offset) / (last.time - first.time) : 0;
    const away = event !== null && now.offset < 0 && (now.offset < -DISTANCE || velocity < -VELOCITY);
    if (away) {
      done.current = true;
      if (reduced) {
        motion.current?.cancel();
        onDismiss(false);
        return;
      }
      // Off the top edge, at least as fast as the finger left it.
      const target = shown - element.getBoundingClientRect().bottom - 16;
      const duration = Math.min(motionDuration("base"), Math.max(motionDuration("fast"), Math.abs(target - shown) / Math.max(-velocity, 0.5)));
      motion.current?.cancel();
      const fling = element.animate([at(shown), at(target)], { duration, easing: motionEasing("exit"), fill: "forwards" });
      motion.current = fling;
      fling.onfinish = () => onDismiss(true);
      return;
    }
    motion.current?.cancel();
    motion.current = shown === 0 ? null : element.animate([at(shown), at(0)], { duration: motionDuration("base"), easing: motionEasing("emphasized") });
    onDrag?.(false);
  };

  return {
    onPointerDown(event: PointerEvent<T>) {
      const element = ref.current;
      if (!element || gesture.current || done.current || (event.pointerType === "mouse" && event.button !== 0)) return;
      // Caught while settling back: start from where it is.
      swiped.current = false;
      let from = 0;
      if (motion.current?.playState === "running") {
        const transform = getComputedStyle(element).transform;
        from = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
        hold(element, from);
      }
      gesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, from, offset: from, dragging: false, samples: [] };
      if (from !== 0) {
        gesture.current.dragging = true;
        swiped.current = true;
        element.setPointerCapture(event.pointerId);
        onDrag?.(true);
      }
    },
    onPointerMove(event: PointerEvent<T>) {
      const element = ref.current;
      const now = gesture.current;
      if (!element || !now || event.pointerId !== now.pointer) return;
      const dx = event.clientX - now.x;
      const dy = event.clientY - now.y;
      if (!now.dragging) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        // Sideways: the browser's (a pan, the back gesture), not a dismissal.
        if (Math.abs(dx) > Math.abs(dy)) {
          gesture.current = null;
          return;
        }
        now.dragging = true;
        swiped.current = true;
        element.setPointerCapture(event.pointerId);
        onDrag?.(true);
      }
      now.offset = now.from + dy;
      now.samples.push({ time: event.timeStamp, offset: now.offset });
      if (now.samples.length > 12) now.samples.shift();
      if (!prefersReducedMotion()) hold(element, now.offset < 0 ? now.offset : damp(now.offset));
    },
    onPointerUp(event: PointerEvent<T>) {
      if (ref.current && event.pointerId === gesture.current?.pointer) release(ref.current, event);
    },
    onPointerCancel(event: PointerEvent<T>) {
      if (ref.current && event.pointerId === gesture.current?.pointer) release(ref.current, null);
    },
    onClickCapture(event: MouseEvent<T>) {
      // A click from a key press (`detail` 0) is never the end of a swipe.
      if (!swiped.current || event.detail === 0) return;
      swiped.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
