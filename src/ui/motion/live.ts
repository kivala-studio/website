/*
 * Live values: figures a poll or a Realtime announcement changes while the page is open (prices, changes, totals).
 * Their animations go through `playLive`, which starts the ones of one React commit together, or none of them: when
 * one update changes many figures at once, or the page has just come back from the background (quotes were revoked
 * while it was hidden and the refresh brings them all back), the figures simply update.
 */

/** More changed figures than this in one commit read as a refresh, not as a change worth watching. */
const BURST = 12;
/** After the page is shown again, the first refresh lands within this window. */
const RETURN_MS = 3000;

let shownAt = Number.NEGATIVE_INFINITY;
let watching = false;
let batch: (() => void)[] = [];

function watchVisibility() {
  if (watching) return;
  watching = true;
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) shownAt = performance.now();
  });
}

/** Starts `play` with the other live changes of the same commit, unless they are too many or the page just returned. */
export function playLive(play: () => void) {
  if (typeof document === "undefined") return;
  watchVisibility();
  if (document.hidden || performance.now() - shownAt < RETURN_MS) return;
  batch.push(play);
  if (batch.length > 1) return;
  // Layout effects of one commit run in one task: the microtask sees all of them, and still runs before the paint.
  queueMicrotask(() => {
    const plays = batch;
    batch = [];
    if (plays.length <= BURST) for (const start of plays) start();
  });
}
