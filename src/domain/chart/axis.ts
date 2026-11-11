/*
 * Chart geometry from iOS `AssetChartSection` and `ChartEndpointAxis`. Plotting only: values here
 * place marks on screen and never feed a price, valuation or label.
 */

export type ChartDomain = { readonly lower: number; readonly upper: number };

/** Y range with padding of 12 % of the span, at least 0.5 % of the maximum and at least 1. */
export function chartDomain(values: readonly number[]): ChartDomain {
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 1;
  const padding = Math.max((maximum - minimum) * 0.12, Math.max(maximum * 0.005, 1));
  return { lower: minimum - padding, upper: maximum + padding };
}

export type AxisTick = { readonly value: number; readonly endpoint: boolean };

/**
 * About four ticks on a 1-2-5 step, plus the first and last observed values. Ordinary ticks within
 * 12 % of the span of an endpoint are dropped so the endpoint labels stay readable.
 */
export function axisTicks(domain: ChartDomain, endpoints: readonly number[]): AxisTick[] {
  const distinct = [...new Set(endpoints.filter(Number.isFinite))].sort((a, b) => a - b);
  const span = Math.max(domain.upper - domain.lower, 1);
  const rawStep = span / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = ([1, 2, 5, 10].find((factor) => factor * magnitude >= rawStep) ?? 10) * magnitude;
  const ticks: AxisTick[] = [];
  for (let tick = Math.ceil(domain.lower / step) * step; tick <= domain.upper + step * 1e-9; tick += step) {
    if (!distinct.some((value) => Math.abs(value - tick) < span * 0.12)) ticks.push({ value: tick, endpoint: false });
  }
  return [...ticks, ...distinct.map((value) => ({ value, endpoint: true }))].sort((a, b) => a.value - b.value);
}
