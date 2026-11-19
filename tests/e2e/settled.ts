import type { Page } from "@playwright/test";

/**
 * Waits until every finite animation and transition on the page has finished (a fade-in after data arrived, a row
 * gliding, a value rolling), so a check that samples rendering (axe's contrast, a screenshot) sees the settled page.
 * Endless loading loops (pulse, shimmer, spinner) are ignored. Fades still play with reduced motion, so this is needed
 * there too.
 */
export async function settled(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running" || animation.effect?.getComputedTiming().endTime === Infinity),
  );
}
