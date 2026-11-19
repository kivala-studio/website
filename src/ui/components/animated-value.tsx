"use client";

import { useLayoutEffect, useRef } from "react";

import { playLive } from "../motion/live";
import { useChangeAnimation, valueFlash, valueRoll } from "../motion/use-change-animation";

/**
 * A formatted figure that rolls when it changes: up from below when `numeric` rises, down from above when it falls,
 * a fade when only the text changed. Nothing plays on load, on a re-render with the same text or when a hidden
 * ancestor is shown again. `numeric` is the raw value as a string (a `Decimal`'s `toString()`), so it crosses the
 * server–client boundary.
 *
 * `live` marks a current quote: when it changes to another current quote, a tint of the direction (positive when it
 * rose, negative when it fell) fades out behind it as it rolls. A figure that becomes live (the first quote replacing
 * the dated close) or stops being live (a revoked quote) simply updates. Every change goes through `playLive`: when
 * one update changes many figures at once, or the page has just come back from the background, they simply update.
 */
export function AnimatedText({ text, numeric, live = false, className }: { text: string; numeric?: string; live?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef({ numeric, live });
  useChangeAnimation(
    ref,
    text,
    () => {
      if (live !== shown.current.live) return null;
      const before = Number(shown.current.numeric ?? NaN);
      const after = Number(numeric ?? NaN);
      const direction = Number.isFinite(before) && Number.isFinite(after) ? Math.sign(after - before) : 0;
      const tint = live ? valueFlash(direction) : null;
      return tint ? [valueRoll(direction), tint] : valueRoll(direction);
    },
    Object.is,
    playLive,
  );
  // After the roll has read the previous value.
  useLayoutEffect(() => {
    shown.current = { numeric, live };
  }, [numeric, live]);
  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
