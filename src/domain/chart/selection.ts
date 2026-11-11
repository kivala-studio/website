/**
 * Index of the observation nearest to `target` in chronological data (iOS `ChartSelection`).
 * Binary search, so dense series stay cheap during a drag; clamps to the endpoints and resolves a tie
 * to the earlier observation. Never interpolates: the result is always a real observation.
 */
export function nearestIndex(count: number, target: number, dateAt: (index: number) => number): number | undefined {
  if (count <= 0) return undefined;
  let lower = 0;
  let upper = count;
  while (lower < upper) {
    const middle = lower + Math.floor((upper - lower) / 2);
    if (dateAt(middle) < target) lower = middle + 1;
    else upper = middle;
  }
  if (lower === 0) return 0;
  if (lower === count) return count - 1;
  const before = Math.abs(dateAt(lower - 1) - target);
  const after = Math.abs(dateAt(lower) - target);
  return before <= after ? lower - 1 : lower;
}

/**
 * Drag pacing (iOS `ChartScrubPacer`): at most 30 selections a second and one feedback every 0.1 s.
 * Times are in seconds. Ending a gesture lets the next one select at once but keeps the feedback
 * interval, so feedback is never queued.
 */
export class ChartScrubPacer {
  static readonly selectionInterval = 1 / 30;
  static readonly feedbackInterval = 0.1;
  private lastSelection: number | undefined;
  private lastFeedback: number | undefined;

  allowsSelection(time: number): boolean {
    if (this.lastSelection !== undefined && time - this.lastSelection < ChartScrubPacer.selectionInterval) return false;
    this.lastSelection = time;
    return true;
  }

  allowsFeedback(time: number): boolean {
    if (this.lastFeedback !== undefined && time - this.lastFeedback < ChartScrubPacer.feedbackInterval) return false;
    this.lastFeedback = time;
    return true;
  }

  endGesture(): void {
    this.lastSelection = undefined;
  }
}
