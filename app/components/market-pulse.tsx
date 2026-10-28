"use client";
import type { Quality } from "../../lib/public-data";
import { date, number } from "../../lib/market-presentation";
import { useClock } from "./use-clock";
import LineChart from "./line-chart";
export type PulseRow = {
  trading_date: string;
  value: number;
  daily_change_percent: number;
  data_quality: Quality;
};
export default function MarketPulse({ rows }: { rows: PulseRow[] | null }) {
  const now = useClock();
  const valid =
    !!rows?.length &&
    rows.every(
      (r) =>
        Number.isFinite(r.value) &&
        r.value > 0 &&
        Number.isFinite(r.daily_change_percent) &&
        /^\d{4}-\d{2}-\d{2}$/.test(r.trading_date) &&
        Date.parse(r.trading_date) <= now &&
        r.data_quality?.status === "valid" &&
        r.data_quality.reasons.length === 0 &&
        (!r.data_quality.validUntilEpoch ||
          r.data_quality.validUntilEpoch * 1000 > now),
    ) &&
    new Set(rows.map((r) => r.trading_date)).size === rows.length;
  const sorted = valid
    ? [...rows!].sort((a, b) => a.trading_date.localeCompare(b.trading_date))
    : [];
  const last = sorted.at(-1);
  return (
    <section className="dashboard-panel public-section">
      <div className="section-title">
        <div>
          <h2>Indicador invest.ao</h2>
        </div>
        {last && (
          <div className="pulse-value">
            <strong>{number(last.value)}</strong>
            <span
              className={
                last.daily_change_percent >= 0 ? "positive" : "negative"
              }
            >
              {last.daily_change_percent > 0 ? "+" : ""}
              {number(last.daily_change_percent)}%
            </span>
            <small>Fechos de {date(last.trading_date)}</small>
          </div>
        )}
      </div>
      {last ? (
        <LineChart
          label="Evolução do Indicador invest.ao"
          series={[
            {
              label: "Indicador invest.ao",
              color: "var(--accent)",
              points: sorted.map((r) => ({
                x: Date.parse(r.trading_date),
                y: r.value,
                label: date(r.trading_date),
              })),
            },
          ]}
        />
      ) : (
        <p className="empty-state">
          Indicador indisponível enquanto os dados usados no cálculo não
          estiverem verificados.
        </p>
      )}
      <details>
        <summary>Como é calculado?</summary>
        <p className="data-note">
          A série verificada parte de 100 pontos. Em cada sessão, a invest.ao
          calcula a média das variações de pelo menos dois instrumentos com
          fechos verificados nessa sessão e na anterior, com o mesmo peso. Os
          instrumentos elegíveis podem mudar. Uma lacuna inicia uma nova série.
        </p>
      </details>
      <p className="fine-print">
        Calculado pela invest.ao a partir de cotações BODIVA. Não é um índice
        oficial, patrocinado ou aprovado pela BODIVA.
      </p>
    </section>
  );
}
