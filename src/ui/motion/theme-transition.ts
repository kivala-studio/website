"use client";

import { flushSync } from "react-dom";

import { prefersReducedMotion } from "./tokens";

/**
 * Applies a theme change as one cross-fade of the whole page (View Transitions API) instead of a flash, or at once
 * where the API is missing or reduced motion is asked for. `update` changes `data-theme` and whatever React state
 * follows it; it runs inside `flushSync`, so the new snapshot is complete. While it switches, per-element colour
 * transitions are off (`data-theme-switching` in motion.css), so every colour changes in the same frame.
 */
export function switchTheme(update: () => void) {
  const root = document.documentElement;
  const apply = () => {
    root.dataset.themeSwitching = "";
    flushSync(update);
    // Resolve the new colours while transitions are off, so turning them back on starts none.
    void getComputedStyle(root).color;
  };
  const settle = () => {
    delete root.dataset.themeSwitching;
  };
  if (typeof document.startViewTransition !== "function" || prefersReducedMotion()) {
    apply();
    requestAnimationFrame(settle);
    return;
  }
  const transition = document.startViewTransition(apply);
  transition.finished.finally(settle);
}

/**
 * Applies a change that touches figures all over the page at once (privacy mode masking every personal value) as one
 * quick cross-fade (`base`), or at once where View Transitions are missing or reduced motion is asked for. `update`
 * runs inside `flushSync`, so the new snapshot is complete.
 */
export function crossFadePage(update: () => void) {
  if (typeof document.startViewTransition !== "function" || prefersReducedMotion()) {
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset.crossFade = "";
  const transition = document.startViewTransition(() => flushSync(update));
  transition.finished.finally(() => {
    delete root.dataset.crossFade;
  });
}
