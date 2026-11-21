import type { Page } from "@playwright/test";

/**
 * Waits until every finite animation and transition on the page has finished (a fade-in after data arrived, a row
 * gliding, a value rolling), so a check that samples rendering (axe's contrast, a screenshot) sees the settled page.
 * Endless loading loops (pulse, shimmer, spinner) are ignored, and so are animations on a scroll or view timeline (the
 * top bar lifting as the page scrolls): they follow the scroll position, not the clock, and never finish. Fades still
 * play with reduced motion, so this is needed there too.
 */
export async function settled(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.timeline !== document.timeline || animation.playState !== "running" || animation.effect?.getComputedTiming().endTime === Infinity,
      ),
  );
}
