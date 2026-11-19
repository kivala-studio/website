"use client";

import { useLayoutEffect, useRef } from "react";

import { useChangeAnimation, valueRoll } from "../motion/use-change-animation";

/**
 * A formatted figure that rolls when it changes: up from below when `numeric` rises, down from above when it falls,
 * a fade when only the text changed. Nothing plays on load, on a re-render with the same text or when a hidden
 * ancestor is shown again. `numeric` is the raw value as a string (a `Decimal`'s `toString()`), so it crosses the
 * server–client boundary.
 */
export function AnimatedText({ text, numeric, className }: { text: string; numeric?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(numeric);
  useChangeAnimation(ref, text, () => {
    const before = Number(shown.current ?? NaN);
    const after = Number(numeric ?? NaN);
    return valueRoll(Number.isFinite(before) && Number.isFinite(after) ? Math.sign(after - before) : 0);
  });
  // After the roll has read the previous value.
  useLayoutEffect(() => {
    shown.current = numeric;
  }, [numeric]);
  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
