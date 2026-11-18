"use client";

import { useEffect } from "react";

/** Targets that enter together are staggered up to this step (`data-reveal-step`, 60 ms each, `motion.css`). */
const LAST_STEP = 5;

/**
 * The landing's scroll reveal: renders nothing. After mount, on a screen that allows motion, it gives every
 * `[data-reveal]` target that is still wholly below the fold its start state, then eases each one in once as it
 * enters the viewport, never hiding it again. Targets that enter in the same frame follow each other by one step, in
 * page order; targets above one that enters (a jump down the page) are shown with it, unstaggered. Server markup is the
 * end state, so the page reads the same without JavaScript.
 */
export function Reveal() {
  useEffect(() => {
    if (!("IntersectionObserver" in window) || !window.matchMedia("screen and (prefers-reduced-motion: no-preference)").matches) return;
    const fold = window.innerHeight;
    const pending = [...document.querySelectorAll<HTMLElement>("[data-reveal]")].filter((target) => target.getBoundingClientRect().top >= fold);
    if (pending.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entering = new Set(entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target));
        const last = pending.findLastIndex((target) => entering.has(target));
        if (last < 0) return;
        let step = 0;
        for (const target of pending.splice(0, last + 1)) {
          observer.unobserve(target);
          if (entering.has(target)) target.dataset.revealStep = String(Math.min(step++, LAST_STEP));
          target.dataset.revealState = "shown";
        }
        if (pending.length === 0) observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const target of pending) {
      target.dataset.revealState = "pending";
      observer.observe(target);
    }
    return () => {
      observer.disconnect();
      for (const target of pending) delete target.dataset.revealState;
    };
  }, []);
  return null;
}
