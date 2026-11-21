/*
 * The motion tokens for scripts (Web Animations). The values live in `src/ui/theme/motion.css`; these read them from
 * the page so CSS stays the one source, with the same numbers as a fallback before styles load.
 */

export type MotionDuration = "fast" | "base" | "slow" | "flash";
export type MotionEasing = "standard" | "emphasized" | "exit";

const DURATION_FALLBACK: Record<MotionDuration, number> = { fast: 140, base: 220, slow: 340, flash: 900 };
const EASING_FALLBACK: Record<MotionEasing, string> = {
  standard: "cubic-bezier(0.25, 0.8, 0.25, 1)",
  emphasized: "cubic-bezier(0.22, 1, 0.36, 1)",
  // The emphasized curve under the name of the leaving side (`--ease-exit: var(--ease-emphasized)`).
  exit: "cubic-bezier(0.22, 1, 0.36, 1)",
};

const token = (name: string) =>
  typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** A duration token in milliseconds (`--duration-base` → 220). */
export function motionDuration(name: MotionDuration): number {
  const value = token(`--duration-${name}`);
  const parsed = value.endsWith("ms") ? parseFloat(value) : value.endsWith("s") ? parseFloat(value) * 1000 : NaN;
  return Number.isFinite(parsed) ? parsed : DURATION_FALLBACK[name];
}

/** An easing token as a timing function (`--ease-emphasized`). */
export function motionEasing(name: MotionEasing): string {
  return token(`--ease-${name}`) || EASING_FALLBACK[name];
}

/** Whether the visitor asked for reduced motion; scripts then change state at once. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A colour token as the page resolves it now (`positive` → the current theme's value), for keyframes. */
export function motionColour(name: "positive" | "negative"): string {
  return token(`--color-${name}`);
}
