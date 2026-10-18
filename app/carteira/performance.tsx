"use client";
import { useCallback, useMemo, useState } from "react";
import type { Transaction } from "../../lib/account-data";
import { portfolioHistory } from "../../lib/finance";
import { date } from "../../lib/market-presentation";
import { useAccount } from "../components/account-provider";
import { ResourceState, useResource } from "../components/async-state";
import { fetchHistory, ranges } from "../components/history-chart";
import LineChart from "../components/line-chart";
export default function PortfolioPerformance({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const { privateMode } = useAccount();
  const [range, setRange] = useState<keyof typeof ranges>("1A");
  const [now] = useState(() => Date.now());
  const ids = [...new Set(transactions.map((t) => t.security_id))]
    .sort()
    .join(",");
  const load = useCallback(
    async () =>
      Object.fromEntries(
        await Promise.all(
          ids
            .split(",")
            .filter(Boolean)
            .map(async (id) => [id, await fetchHistory(id)]),
        ),
      ),
    [ids],
  );
  const state = useResource(load);
  const calculated = useMemo(() => {
    try {
      return {
        points: state.data ? portfolioHistory(transactions, state.data) : [],
        error: "",
      };
    } catch {
      return {
        points: [],
        error: "Não foi possível validar o histórico da carteira.",
      };
    }
  }, [transactions, state.data]);
  const points = calculated.points.filter(
    (p) =>
      !ranges[range] || Date.parse(p.day) >= now - ranges[range] * 86400000,
  );
  return (
    <section className="dashboard-panel public-section">
      <div className="section-title">
        <h2>Evolução da carteira</h2>
        <span className="fine-print">Valor das posições abertas</span>
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
      <ResourceState
        loading={state.loading}
        error={state.error || calculated.error}
        retry={state.reload}
      />
      {privateMode ? (
        <p className="empty-state">
          O gráfico fica oculto no modo de privacidade.
        </p>
      ) : (
        !calculated.error &&
        state.data && (
          <LineChart
            label="Valor histórico das posições em carteira"
            unit=" Kz"
            series={[
              {
                label: "Carteira",
                color: "var(--accent)",
                points: points.map((p) => ({
                  x: Date.parse(p.day),
                  y: p.value,
                  label: date(p.day),
                })),
              },
            ]}
          />
        )
      )}
      <p className="data-note">
        Só são apresentadas datas com fechos para todas as posições abertas
        nesse dia. Compras e vendas alteram o valor do gráfico; a variação não
        representa rendibilidade. Não inclui saldo de vendas, dividendos,
        comissões ou impostos.
      </p>
    </section>
  );
}
