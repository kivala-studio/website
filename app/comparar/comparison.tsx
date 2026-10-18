"use client";
import { useCallback, useState } from "react";
import type { Security } from "../../lib/public-data";
import { date, kind } from "../../lib/market-presentation";
import { ranges, fetchHistory } from "../components/history-chart";
import { ResourceState, useResource } from "../components/async-state";
import LineChart from "../components/line-chart";
export default function Comparison({ securities }: { securities: Security[] }) {
  const preferred = securities.filter((s) => kind(s) === "Acções");
  const [first, setFirst] = useState(
    preferred[0]?.id || securities[0]?.id || "",
  );
  const [second, setSecond] = useState(
    preferred[1]?.id || securities[1]?.id || "",
  );
  return (
    <>
      <div className="form-grid">
        <label>
          Primeiro instrumento
          <select value={first} onChange={(e) => setFirst(e.target.value)}>
            {securities.map((s) => (
              <option key={s.id} value={s.id}>
                {s.symbol} · {s.issuers?.name || s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Segundo instrumento
          <select value={second} onChange={(e) => setSecond(e.target.value)}>
            {securities.map((s) => (
              <option key={s.id} value={s.id}>
                {s.symbol} · {s.issuers?.name || s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {first && second && first !== second ? (
        <CompareChart
          key={`${first}-${second}`}
          first={securities.find((s) => s.id === first)!}
          second={securities.find((s) => s.id === second)!}
        />
      ) : (
        <p className="empty-state">Selecciona dois instrumentos diferentes.</p>
      )}
    </>
  );
}
function CompareChart({
  first,
  second,
}: {
  first: Security;
  second: Security;
}) {
  const load = useCallback(
    () => Promise.all([fetchHistory(first.id), fetchHistory(second.id)]),
    [first.id, second.id],
  );
  const state = useResource(load);
  const [range, setRange] = useState<keyof typeof ranges>("1A");
  const [asOf] = useState(() => Date.now());
  const cutoff = ranges[range] ? asOf - ranges[range] * 86400000 : 0;
  const a = (state.data?.[0] || []).filter(
    (p) => Date.parse(p.trading_date) >= cutoff,
  );
  const b = (state.data?.[1] || []).filter(
    (p) => Date.parse(p.trading_date) >= cutoff,
  );
  const bDates = new Set(b.map((p) => p.trading_date));
  const common = a
    .filter((p) => bDates.has(p.trading_date))
    .map((p) => p.trading_date);
  const commonSet = new Set(common);
  const series = [a, b].map((rows, index) => {
    const shared = rows.filter((p) => commonSet.has(p.trading_date));
    const base = shared[0]?.close_price;
    return {
      label: index ? second.symbol : first.symbol,
      color: index ? "var(--comparison-orange)" : "var(--accent)",
      points: base
        ? shared.map((p) => ({
            x: Date.parse(p.trading_date),
            y: (p.close_price / base - 1) * 100,
            label: date(p.trading_date),
          }))
        : [],
    };
  });
  return (
    <section className="chart-box">
      <div className="section-title">
        <h2>Variação de preço desde a base comum</h2>
        <span className="fine-print">
          {common[0] ? `Base: ${date(common[0])}` : "Sem data comum"}
        </span>
      </div>
      <div className="period-tabs">
        {Object.keys(ranges).map((key) => (
          <button
            key={key}
            aria-pressed={range === key}
            onClick={() => setRange(key as keyof typeof ranges)}
          >
            {key}
          </button>
        ))}
      </div>
      <ResourceState {...state} retry={state.reload} />
      {state.data &&
        (common.length >= 2 ? (
          <LineChart
            series={series}
            label={`Comparação de ${first.symbol} e ${second.symbol}`}
            unit="%"
          />
        ) : (
          <p className="empty-state">
            Não existem duas datas com fechos para ambos os instrumentos neste
            período.
          </p>
        ))}
      <p className="data-note">
        Compara apenas variação de preço nas datas com observações para ambos os
        instrumentos. Não inclui dividendos, cupões, taxas ou conversão cambial.
        A variação de preço de uma obrigação não é a sua rendibilidade.
      </p>
    </section>
  );
}
