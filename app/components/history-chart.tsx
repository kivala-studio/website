"use client";
import { useCallback, useState } from "react";
import type { HistoryPoint } from "../../lib/history";
import { date, kind } from "../../lib/market-presentation";
import type { Security } from "../../lib/public-data";
import LineChart from "./line-chart";
import IntradayChart from "./intraday-chart";
import { useResource, ResourceState } from "./async-state";
export const ranges = { "1M": 31, "3M": 93, "6M": 186, "1A": 366, Tudo: 0 };
export async function fetchHistory(id: string): Promise<HistoryPoint[]> {
  const response = await fetch(`/api/history?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("History unavailable");
  return response.json();
}
export default function HistoryChart({ security }: { security: Security }) {
  const [range, setRange] = useState<keyof typeof ranges | "1D">("1A");
  const load = useCallback(() => fetchHistory(security.id), [security.id]);
  const state = useResource(load);
  const [asOf] = useState(() => Date.now());
  const cutoff =
    range !== "1D" && ranges[range] ? asOf - ranges[range] * 86400000 : 0;
  const points = (state.data || [])
    .filter((p) => Date.parse(p.trading_date) >= cutoff)
    .map((p) => ({
      x: Date.parse(p.trading_date),
      y: p.close_price,
      label: date(p.trading_date),
    }));
  return (
    <section className="chart-box">
      <div className="section-title">
        <h2>Evolução do preço</h2>
        <span className="fine-print">Fechos históricos · BODIVA</span>
      </div>
      <div className="period-tabs">
        {["1D", ...Object.keys(ranges)].map((key) => (
          <button
            key={key}
            aria-pressed={range === key}
            onClick={() => setRange(key as keyof typeof ranges | "1D")}
          >
            {key}
          </button>
        ))}
      </div>
      {range === "1D" ? (
        <IntradayChart security={security} />
      ) : (
        <>
          <ResourceState {...state} retry={state.reload} />
          {state.data && (
            <LineChart
              series={[
                { label: security.symbol, color: "var(--accent)", points },
              ]}
              label={`Histórico de fechos de ${security.symbol}`}
              unit={
                kind(security).startsWith("Obrigações")
                  ? "%"
                  : ` ${security.currency === "AOA" ? "Kz" : security.currency}`
              }
            />
          )}
        </>
      )}
      <p className="fine-print">
        Cada observação corresponde a um fecho disponível. As linhas ligam
        observações; não representam preços nos dias sem dados.
      </p>
    </section>
  );
}
