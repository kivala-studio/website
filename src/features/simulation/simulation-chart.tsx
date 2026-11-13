"use client";

import { useTranslations } from "next-intl";
import { type KeyboardEvent, type PointerEvent, useId, useMemo, useRef } from "react";

import type { SimulationResult } from "@/domain/simulation/simulation";

const WIDTH = 600;
const HEIGHT = 200;
const PAD = 8;

/**
 * Projected value (solid, with a fading area) over cumulative contributions (dashed). Dragging or arrow keys
 * select a month and the headline follows; leaving returns to the horizon.
 */
export function SimulationChart({
  result,
  selected,
  onSelect,
  horizonLabel,
  summary,
}: {
  result: SimulationResult;
  selected: number | null;
  onSelect: (month: number | null) => void;
  horizonLabel: string;
  summary: string;
}) {
  const t = useTranslations();
  const gradient = useId();
  const surface = useRef<SVGSVGElement>(null);
  const points = result.monthlyPoints;
  const last = points.length - 1;

  const geometry = useMemo(() => {
    // Chart coordinates only: the figures shown stay exact.
    const balances = points.map((point) => point.balance.toNumber());
    const invested = points.map((point) => point.contributions.toNumber());
    const top = Math.max(...balances, ...invested) || 1;
    const x = (month: number) => (last === 0 ? WIDTH / 2 : (month / last) * WIDTH);
    const y = (value: number) => PAD + (1 - value / top) * (HEIGHT - 2 * PAD);
    const path = (values: number[]) => values.map((value, month) => `${month === 0 ? "M" : "L"}${x(month).toFixed(2)},${y(value).toFixed(2)}`).join("");
    const line = path(balances);
    return {
      x,
      y,
      balances,
      line,
      area: `${line}L${x(last).toFixed(2)},${HEIGHT}L0,${HEIGHT}Z`,
      invested: path(invested),
    };
  }, [points, last]);

  const monthAt = (event: PointerEvent<SVGSVGElement>) => {
    const box = surface.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    return Math.round(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * last);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const current = selected ?? last;
    const next = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onSelect(Math.min(last, Math.max(0, next)));
  };

  return (
    <figure className="flex flex-col gap-2" data-testid="simulation-chart">
      <div className="relative h-50">
        <svg
          ref={surface}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full touch-none overflow-visible outline-none focus-visible:outline-2 focus-visible:outline-accent"
          role="slider"
          tabIndex={0}
          aria-label={summary}
          aria-valuemin={0}
          aria-valuemax={last}
          aria-valuenow={selected ?? last}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            onSelect(monthAt(event));
          }}
          onPointerMove={(event) => {
            if (event.buttons !== 0 || event.pointerType === "mouse") onSelect(monthAt(event));
          }}
          onPointerUp={(event) => event.pointerType !== "mouse" && onSelect(null)}
          onPointerLeave={() => onSelect(null)}
          onPointerCancel={() => onSelect(null)}
          onKeyDown={onKeyDown}
          onBlur={() => onSelect(null)}
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.24" />
              <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={geometry.area} fill={`url(#${gradient})`} />
          <path
            d={geometry.invested}
            fill="none"
            stroke="var(--color-secondary-text)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
          <path d={geometry.line} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {selected !== null ? (
            <line
              x1={geometry.x(selected)}
              x2={geometry.x(selected)}
              y1={0}
              y2={HEIGHT}
              stroke="var(--color-separator)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
        {selected !== null ? (
          <span
            aria-hidden
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-app-background"
            style={{
              left: `${(geometry.x(selected) / WIDTH) * 100}%`,
              top: `${(geometry.y(geometry.balances[selected]) / HEIGHT) * 100}%`,
            }}
          />
        ) : null}
      </div>
      <div className="flex justify-between text-caption text-secondary-text" aria-hidden>
        <span>{t("common.today")}</span>
        <span>{horizonLabel}</span>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-secondary-text">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full bg-accent" aria-hidden />
          {t("simulation.chart.projectedValue")}
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 border-t-2 border-dashed border-secondary-text" aria-hidden />
          {t("simulation.chart.invested")}
        </span>
      </figcaption>
    </figure>
  );
}
