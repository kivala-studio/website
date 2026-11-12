/** Ordering rules shared by optimistic and confirmed watchlist membership (iOS `WatchlistOrdering`). */

/** Keeps the first occurrence of each id. */
export function deduplicated(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/** Requested watched ids first, then watched ids the request omitted, in their current order. */
export function reordered(requested: readonly string[], current: readonly string[], watched: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  const valid = requested.filter((id) => watched.has(id) && !seen.has(id) && seen.add(id));
  return [...valid, ...current.filter((id) => watched.has(id) && !seen.has(id))];
}

/** Only confirmed membership is persisted; confirmed items the request omitted keep their order at the end. */
export function persistableOrder(requested: readonly string[], confirmedOrder: readonly string[], membership: ReadonlyMap<string, boolean>): string[] {
  const kept = deduplicated(requested.filter((id) => membership.get(id) === true));
  return [...kept, ...confirmedOrder.filter((id) => membership.get(id) === true && !kept.includes(id))];
}

/** A confirmed order leads; newer visible items stay after it unless no longer watched. */
export function merging(confirmed: readonly string[], visible: readonly string[], flags: ReadonlyMap<string, boolean>): string[] {
  const current = confirmed.filter((id) => flags.get(id) !== false);
  const ids = new Set(current);
  return [...current, ...visible.filter((id) => !ids.has(id) && flags.get(id) !== false)];
}

/** Reinserts `id` beside its nearest surviving neighbour from `previousOrder`. */
export function restorePosition(id: string, previousOrder: readonly string[], order: readonly string[]): string[] {
  const next = order.filter((item) => item !== id);
  const index = previousOrder.indexOf(id);
  if (index < 0) return [...next, id];
  const after = previousOrder.slice(index + 1).find((item) => next.includes(item));
  if (after !== undefined) {
    next.splice(next.indexOf(after), 0, id);
    return next;
  }
  const before = previousOrder.slice(0, index).findLast((item) => next.includes(item));
  if (before !== undefined) {
    next.splice(next.indexOf(before) + 1, 0, id);
    return next;
  }
  next.splice(Math.min(index, next.length), 0, id);
  return next;
}

/** Moves one id a step up (-1) or down (+1); the keyboard alternative to dragging. */
export function moved(order: readonly string[], id: string, step: -1 | 1): string[] {
  const index = order.indexOf(id);
  const target = index + step;
  if (index < 0 || target < 0 || target >= order.length) return [...order];
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Group names: trimmed, 1–40 characters (contract §4.2; iOS truncates to 40). */
export const GROUP_NAME_LIMIT = 40;
export function groupName(input: string): string | null {
  const name = [...input.trim()].slice(0, GROUP_NAME_LIMIT).join("").trim();
  return name === "" ? null : name;
}
