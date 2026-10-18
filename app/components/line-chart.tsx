"use client";
import { useRef, useState } from "react";
import { number } from "../../lib/market-presentation";
export type Series = {
  label: string;
  color: string;
  points: { x: number; y: number; label: string }[];
};
export default function LineChart({
  series,
  label,
  unit = "",
}: {
  series: Series[];
  label: string;
  unit?: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const points = series
    .flatMap((s) => s.points)
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (points.length < 2)
    return (
      <div className="empty-state">
        Não há observações suficientes para apresentar o gráfico.
      </div>
    );
  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x));
  const rawMin = Math.min(...points.map((p) => p.y)),
    rawMax = Math.max(...points.map((p) => p.y));
  const padding = (rawMax - rawMin || Math.abs(rawMax) || 1) * 0.15;
  const minY = rawMin - padding,
    maxY = rawMax + padding;
  const x = (value: number) => 70 + ((value - minX) / (maxX - minX || 1)) * 710;
  const y = (value: number) => 210 - ((value - minY) / (maxY - minY)) * 190;
  const days = [...new Set(points.map((p) => p.x))].sort((a, b) => a - b);
  const picked =
    selected === null ? null : Math.max(0, Math.min(days.length - 1, selected));
  function download() {
    if (!svg.current) return;
    const clone = svg.current.cloneNode(true) as SVGSVGElement;
    const styles = getComputedStyle(svg.current);
    clone.querySelectorAll("[stroke], [fill]").forEach((node) => {
      for (const attribute of ["stroke", "fill"]) {
        const value = node.getAttribute(attribute);
        const token = value?.match(/^var\((--[a-z-]+)\)$/)?.[1];
        if (token)
          node.setAttribute(attribute, styles.getPropertyValue(token).trim());
      }
    });
    clone.removeAttribute("role");
    clone.removeAttribute("aria-label");
    const escape = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&apos;",
          })[c]!,
      );
    const exported = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="540" viewBox="0 0 840 378"><rect width="840" height="378" fill="${styles.getPropertyValue("--card").trim()}"/><g font-family="Arial,sans-serif"><text x="20" y="28" font-size="16" fill="${styles.getPropertyValue("--ink").trim()}">${escape(label)}</text><g transform="translate(20 40)">${clone.innerHTML}</g>${series.map((item, index) => `<text x="${20 + index * 270}" y="318" font-size="12" fill="${styles.getPropertyValue("--ink").trim()}">${escape(item.label)} · ${escape(unit)}</text>`).join("")}<text x="20" y="350" font-size="10" fill="${styles.getPropertyValue("--muted").trim()}">invest.ao · ${escape(points[0].label)} — ${escape(points.at(-1)!.label)} · ${label.includes("Projecção") ? "Simulação hipotética" : "Variação de preço; não inclui dividendos ou encargos"}</text></g></svg>`;
    const url = URL.createObjectURL(
      new Blob([exported], { type: "image/svg+xml" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "investao-grafico.svg";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div>
      <svg
        ref={svg}
        viewBox="0 0 800 250"
        role="img"
        aria-label={label}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const target =
            minX +
            ((((event.clientX - bounds.left) / bounds.width) * 800 - 70) /
              710) *
              (maxX - minX);
          const nearest = days.reduce(
            (best, day, index) =>
              Math.abs(day - target) < Math.abs(days[best] - target)
                ? index
                : best,
            0,
          );
          setSelected(nearest);
        }}
      >
        {[0, 1, 2, 3].map((i) => {
          const value = minY + ((maxY - minY) * i) / 3;
          return (
            <g key={i}>
              <line
                x1="70"
                x2="780"
                y1={y(value)}
                y2={y(value)}
                stroke="var(--chart-grid)"
                strokeDasharray="3 5"
              />
              <text x="0" y={y(value) + 4} fontSize="9" fill="var(--tertiary)">
                {number(value)}
                {unit}
              </text>
            </g>
          );
        })}
        {series.map((s) => (
          <polyline
            key={s.label}
            points={s.points.map((p) => `${x(p.x)},${y(p.y)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ))}
        {picked !== null && (
          <line
            x1={x(days[picked])}
            x2={x(days[picked])}
            y1="20"
            y2="210"
            stroke="var(--tertiary)"
            strokeDasharray="3 3"
          />
        )}
        <text x="70" y="238" fontSize="10" fill="var(--tertiary)">
          {points.find((p) => p.x === minX)?.label}
        </text>
        <text
          x="780"
          y="238"
          textAnchor="end"
          fontSize="10"
          fill="var(--tertiary)"
        >
          {points.find((p) => p.x === maxX)?.label}
        </text>
      </svg>
      <label className="chart-scrubber">
        Explorar observações
        <input
          aria-label="Seleccionar observação do gráfico"
          type="range"
          min="0"
          max={days.length - 1}
          value={picked ?? days.length - 1}
          onChange={(e) => setSelected(Number(e.target.value))}
        />
      </label>
      {picked !== null && (
        <p className="fine-print" aria-live="polite">
          {series
            .map((s) => {
              const point = s.points.find((p) => p.x === days[picked]);
              return point
                ? `${s.label} · ${point.label}: ${number(point.y)}${unit}`
                : `${s.label}: sem observação nesta data`;
            })
            .join(" | ")}
        </p>
      )}
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <button
        type="button"
        className="text-button chart-export"
        onClick={download}
      >
        Guardar gráfico
      </button>
      <details className="chart-data">
        <summary>Consultar dados do gráfico</summary>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Série</th>
                <th>Observação</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {series.flatMap((s) =>
                s.points.map((p) => (
                  <tr key={`${s.label}-${p.x}`}>
                    <td>{s.label}</td>
                    <td>{p.label}</td>
                    <td>
                      {number(p.y)}
                      {unit}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
