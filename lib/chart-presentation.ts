type PricePoint = { x: number; y: number };

/** Visible endpoints in time order, ignoring unusable observations. */
export function priceEndpoints<T extends PricePoint>(points: readonly T[]): [T, T] | null {
  const observed = points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .sort((a, b) => a.x - b.x);
  const first = observed[0];
  const last = observed.at(-1);
  return first && last ? [first, last] : null;
}

export function priceTrendColor(points: readonly PricePoint[]) {
  const endpoints = priceEndpoints(points);
  if (!endpoints || endpoints[0].x === endpoints[1].x || endpoints[0].y === endpoints[1].y)
    return "var(--accent)";
  return endpoints[1].y > endpoints[0].y ? "var(--positive)" : "var(--negative)";
}
