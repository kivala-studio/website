"use client";
import { useClock } from "../components/use-clock";
import { useState } from "react";
import type { Market } from "../../lib/public-data";
import { kind, usableQuote, number } from "../../lib/market-presentation";
import { simulate, type SimulationInput } from "../../lib/finance";
import LineChart from "../components/line-chart";
export default function Simulator({ market }: { market: Market | null }) {
  const now = useClock();
  const [input, setInput] = useState<SimulationInput>({
    initial: "100000",
    monthly: "10000",
    annual: "8",
    months: 60,
  });
  const [securityID, setSecurityID] = useState("");
  const instruments = (market?.securities || [])
    .filter(
      (s) => ["Acções", "Fundos"].includes(kind(s)) && s.currency === "AOA",
    )
    .flatMap((s) => {
      const quote = usableQuote(s, market!, now);
      return quote ? [{ security: s, quote }] : [];
    });
  const selected = instruments.find((row) => row.security.id === securityID);
  const calculation = (() => {
    try {
      if (securityID && !selected)
        throw new Error(
          "A referência deste instrumento deixou de estar disponível. Escolhe outro instrumento.",
        );
      return {
        result: simulate(
          input,
          selected
            ? {
                price: selected.quote.price!,
                fractional: kind(selected.security) === "Fundos",
              }
            : undefined,
        ),
        error: "",
      };
    } catch (e) {
      return {
        result: null,
        error: e instanceof Error ? e.message : "Revê os valores.",
      };
    }
  })();
  const result = calculation.result;
  return (
    <>
      <div className="split-layout">
        <section>
          {result ? (
            <>
              <div className="metric-grid">
                <div>
                  <span>Valor final hipotético</span>
                  <strong>{number(result.balance)} Kz</strong>
                </div>
                <div>
                  <span>Total de contribuições</span>
                  <strong>{number(result.contributions)} Kz</strong>
                </div>
                <div>
                  <span>Ganho hipotético</span>
                  <strong
                    className={result.gain >= 0 ? "positive" : "negative"}
                  >
                    {number(result.gain)} Kz
                  </strong>
                </div>
              </div>
              <div className="chart-box">
                <h2>A tua hipótese ao longo do tempo</h2>
                <LineChart
                  label="Projecção de saldo e contribuições mensais"
                  unit=" Kz"
                  series={[
                    {
                      label: "Saldo hipotético",
                      color: "var(--accent)",
                      points: result.points.map((p) => ({
                        x: Number(p.date),
                        y: p.value,
                        label: `Mês ${p.date}`,
                      })),
                    },
                    {
                      label: "Contribuições",
                      color: "var(--tertiary)",
                      points: result.points.map((p) => ({
                        x: Number(p.date),
                        y: p.contributions,
                        label: `Mês ${p.date}`,
                      })),
                    },
                  ]}
                />
              </div>
              {selected && (
                <div className="dashboard-panel">
                  <h2>Unidades e saldo por investir</h2>
                  <div className="metric-grid">
                    <div>
                      <span>Quantidade final</span>
                      <strong>{number(result.quantity)}</strong>
                    </div>
                    <div>
                      <span>Saldo por investir</span>
                      <strong>{number(result.cash)} Kz</strong>
                    </div>
                    <div>
                      <span>Preço final hipotético</span>
                      <strong>{number(result.price)} Kz</strong>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="error-state" role="alert">
              {calculation.error}
            </p>
          )}
        </section>
        <form
          className="form-panel sticky-panel"
          onSubmit={(e) => e.preventDefault()}
        >
          <h2>Define a tua hipótese</h2>
          <label>
            Tipo de simulação
            <select
              value={securityID}
              onChange={(e) => setSecurityID(e.target.value)}
            >
              <option value="">Projecção geral</option>
              {instruments.map((row) => (
                <option key={row.security.id} value={row.security.id}>
                  {row.security.symbol} · {number(row.quote.price!)} Kz
                </option>
              ))}
            </select>
          </label>
          <label>
            Investimento inicial (Kz)
            <input
              type="number"
              min="0"
              max="1000000000000"
              step="any"
              value={input.initial}
              onChange={(e) => setInput({ ...input, initial: e.target.value })}
            />
          </label>
          <label>
            Reforço mensal (Kz)
            <input
              type="number"
              min="0"
              max="1000000000000"
              step="any"
              value={input.monthly}
              onChange={(e) => setInput({ ...input, monthly: e.target.value })}
            />
          </label>
          <label>
            Rendibilidade anual assumida (%)
            <input
              type="number"
              min="-99.999999"
              max="100"
              step="any"
              value={input.annual}
              onChange={(e) => setInput({ ...input, annual: e.target.value })}
            />
          </label>
          <label>
            Prazo (meses)
            <input
              type="number"
              min="1"
              max="600"
              step="1"
              value={input.months || ""}
              onChange={(e) =>
                setInput({ ...input, months: Number(e.target.value) })
              }
            />
          </label>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setSecurityID("");
              setInput({
                initial: "100000",
                monthly: "10000",
                annual: "8",
                months: 60,
              });
            }}
          >
            Repor valores
          </button>
        </form>
      </div>
      <p className="data-note">
        Simulação hipotética, sem garantia de rendibilidade. A taxa é definida
        por ti, não é uma previsão. Os reforços são aplicados no fim de cada
        mês. Não inclui comissões, impostos, dividendos ou inflação. Nas acções
        são compradas unidades inteiras; nos fundos são admitidas fracções. O
        saldo não investido não rende juros.
      </p>
    </>
  );
}
