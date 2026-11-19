"use client";

import { useRef } from "react";

import { cn } from "../cn";
import { barGrow, useChangeAnimation } from "../motion/use-change-animation";

/**
 * A share of a whole as a thin bar (an allocation weight): `role="meter"`, 0–100. When the value changes the fill
 * grows or shrinks from where it was (`barGrow`); on load it is simply there. The fill is an SVG rect sized by its
 * `width` attribute, so no inline style is needed.
 */
export function Meter({ value, label, className }: { value: number; label: string; className?: string }) {
  const fill = useRef<SVGRectElement>(null);
  const share = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 100);
  useChangeAnimation(fill, share, barGrow);
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={share}
      className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-track", className)}
    >
      <svg viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden className="block size-full">
        <rect width={share} height={1} className="origin-left fill-accent [transform-box:fill-box]" />
      </svg>
    </span>
  );
}
