"use client";

import { useTranslations } from "next-intl";
import { type KeyboardEvent, type PointerEvent, useId, useMemo, useRef } from "react";

import { axisTicks, chartDomain } from "@/domain/chart/axis";
import { ChartScrubPacer, nearestIndex } from "@/domain/chart/selection";
import type { PricePoint } from "@/domain/market";
import { cn } from "@/ui/cn";
import { useFormat } from "@/ui/format";

/** Plot height (iOS asset chart: 258 pt). The plot is drawn in a 1000-unit-wide box stretched to its width. */
export const CHART_HEIGHT = 258;
const WIDTH = 1000;
const INSET = 10;

export type ChartTone = "positive" | "negative" | "accent";

const TONE = {
  positive: { stroke: "stroke-positive", fill: "fill-positive/10", text: "fill-positive" },
  negative: { stroke: "stroke-negative", fill: "fill-negative/10", text: "fill-negative" },
  accent: { stroke: "stroke-accent", fill: "fill-accent/10", text: "fill-accent" },
} as const;

/** Direction of the visible range: green up, red down, accent when flat. */
export function chartTone(points: readonly PricePoint[]): ChartTone {
  const first = points[0]?.value;
  const last = points.at(-1)?.value;
  if (!first || !last || points.length < 2) return "accent";
  return last.gt(first) ? "positive" : last.lt(first) ? "negative" : "accent";
}

/**
 * Line + 10 % area over real observations, linear, with first and last values pinned on the
 * right-hand axis. Pointer and arrow keys select the nearest real observation; nothing is
 * interpolated. Every colour comes from a class, so the strict CSP needs no inline style.
 */
export function PriceChart({
  points,
  bond,
  currency,
  lineWidth,
  selected,
  onSelect,
}: {
  points: readonly PricePoint[];
  bond: boolean;
  currency: string;
  lineWidth: number;
  selected: number | undefined;
  onSelect: (index: number | undefined) => void;
}) {
  const t = useTranslations();
  const format = useFormat();
  const summaryID = useId();
  const plot = useRef<HTMLDivElement>(null);
  const pacer = useRef(new ChartScrubPacer());
  const tone = TONE[chartTone(points)];

  const geometry = useMemo(() => {
    const values = points.map((point) => point.value.toNumber());
    const domain = chartDomain(values);
    const first = points[0]?.date ?? 0;
    const span = Math.max((points.at(-1)?.date ?? 0) - first, 1);
    const x = (date: number) => (points.length < 2 ? WIDTH / 2 : ((date - first) / span) * WIDTH);
    const y = (value: number) => INSET + (1 - (value - domain.lower) / (domain.upper - domain.lower)) * (CHART_HEIGHT - 2 * INSET);
    const coordinates = points.map((point, index) => [x(point.date), y(values[index])] as const);
    const line = coordinates.map(([px, py], index) => `${index === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`).join(" ");
    const base = y(Math.min(...values));
    const area = coordinates.length > 1 ? `${line} L${coordinates.at(-1)![0].toFixed(2)} ${base.toFixed(2)} L${coordinates[0][0].toFixed(2)} ${base.toFixed(2)} Z` : "";
    const endpoints = values.length ? [values[0], values.at(-1)!] : [];
    const ticks = axisTicks(domain, endpoints).map((tick) => ({ ...tick, y: y(tick.value) }));
    const span09 = (domain.upper - domain.lower) * 0.09;
    const labelled = ticks.map((tick) => {
      const other = tick.endpoint ? ticks.find((item) => item.endpoint && item.value !== tick.value && Math.abs(item.value - tick.value) < span09) : undefined;
      return { ...tick, offset: other ? (tick.value > other.value ? -7 : 7) : 0 };
    });
    return { coordinates, line, area, ticks: labelled, first, span };
  }, [points]);

  const price = (point: PricePoint) => format.securityPrice(point.value, { bond, code: currency });
  const summary =
    points.length > 0 ? t("common.startedEndedSummary", { arg1: price(points[0]), arg2: price(points.at(-1)!) }) : t("common.noData");
  const selectedPoint = selected === undefined ? undefined : points[selected];

  const selectAt = (clientX: number) => {
    const box = plot.current?.getBoundingClientRect();
    if (!box || box.width === 0 || points.length === 0) return;
    if (!pacer.current.allowsSelection(performance.now() / 1000)) return;
    const fraction = Math.min(Math.max((clientX - box.left) / box.width, 0), 1);
    const index = nearestIndex(points.length, geometry.first + fraction * geometry.span, (offset) => points[offset].date);
    if (index !== undefined && index !== selected) onSelect(index);
  };
  const end = () => {
    pacer.current.endGesture();
    onSelect(undefined);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    selectAt(event.clientX);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || event.buttons > 0) selectAt(event.clientX);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = points.length - 1;
    if (last < 0) return;
    const current = selected ?? last;
    const next = {
      ArrowLeft: selected === undefined ? last : Math.max(current - 1, 0),
      ArrowDown: selected === undefined ? last : Math.max(current - 1, 0),
      ArrowRight: selected === undefined ? last : Math.min(current + 1, last),
      ArrowUp: selected === undefined ? last : Math.min(current + 1, last),
      Home: 0,
      End: last,
    }[event.key];
    if (event.key === "Escape" && selected !== undefined) {
      event.preventDefault();
      onSelect(undefined);
      return;
    }
    if (next === undefined) return;
    event.preventDefault();
    onSelect(next);
  };

  const selectedCoordinate = selected === undefined ? undefined : geometry.coordinates[selected];
  const dot = (coordinate: readonly [number, number] | undefined, size: number, className: string) =>
    coordinate ? (
      <path d={`M${coordinate[0].toFixed(2)} ${coordinate[1].toFixed(2)}h0`} strokeWidth={size} strokeLinecap="round" vectorEffect="non-scaling-stroke" className={className} />
    ) : null;

  return (
    <div className="flex w-full gap-2">
      <div
        ref={plot}
        role="slider"
        tabIndex={0}
        aria-label={t("assetDetails.accessibility.priceHistory")}
        aria-describedby={summaryID}
        aria-valuemin={0}
        aria-valuemax={Math.max(points.length - 1, 0)}
        aria-valuenow={selected ?? Math.max(points.length - 1, 0)}
        aria-valuetext={selectedPoint ? `${format.date(selectedPoint.date)}: ${price(selectedPoint)}` : summary}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => event.pointerType !== "mouse" && end()}
        onPointerLeave={end}
        onPointerCancel={end}
        onKeyDown={onKeyDown}
        onBlur={() => selected !== undefined && onSelect(undefined)}
        className="relative min-w-0 flex-1 cursor-crosshair touch-pan-y rounded-small select-none"
      >
        <svg viewBox={`0 0 ${WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" aria-hidden className="block h-[258px] w-full overflow-visible">
          {geometry.ticks.map((tick) => (
            <line
              key={`grid-${tick.value}`}
              x1={0}
              x2={WIDTH}
              y1={tick.y}
              y2={tick.y}
              strokeWidth={tick.endpoint ? 0.7 : 0.5}
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
              className={tick.endpoint ? cn(tone.stroke, "opacity-35") : "stroke-chart-grid"}
            />
          ))}
          {geometry.area ? <path d={geometry.area} className={tone.fill} /> : null}
          <path
            d={geometry.line}
            fill="none"
            strokeWidth={lineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className={tone.stroke}
          />
          {dot(geometry.coordinates[0], 6, tone.stroke)}
          {geometry.coordinates.length > 1 ? dot(geometry.coordinates.at(-1), 6, tone.stroke) : null}
          {selectedCoordinate ? (
            <>
              <line
                x1={selectedCoordinate[0]}
                x2={selectedCoordinate[0]}
                y1={0}
                y2={CHART_HEIGHT}
                strokeWidth={1}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
                className="stroke-secondary-text"
              />
              {dot(selectedCoordinate, 13, "stroke-app-background")}
              {dot(selectedCoordinate, 9, tone.stroke)}
            </>
          ) : null}
        </svg>
        <p id={summaryID} className="sr-only">
          {summary}
        </p>
      </div>
      <svg viewBox={`0 0 56 ${CHART_HEIGHT}`} width={56} height={CHART_HEIGHT} aria-hidden className="shrink-0 overflow-visible">
        {geometry.ticks.map((tick) => (
          <text
            key={`label-${tick.value}`}
            x={2}
            y={tick.y + tick.offset}
            dominantBaseline="middle"
            fontSize={11}
            fontWeight={tick.endpoint ? 600 : 400}
            className={tick.endpoint ? tone.text : "fill-tertiary-text"}
          >
            {format.chartAxis(tick.value)}
          </text>
        ))}
      </svg>
    </div>
  );
}
