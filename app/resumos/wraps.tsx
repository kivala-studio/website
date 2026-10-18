"use client";
import WrapStories from "./stories";
import { useClock } from "../components/use-clock";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAccount } from "../components/account-provider";
import { useResource, ResourceState } from "../components/async-state";
import { date, number, priceText } from "../../lib/market-presentation";
import type { Market } from "../../lib/public-data";

import {
  wrapRows,
  type WrapWindow as Window,
  type WrapEvidence as Evidence,
} from "../../lib/wrap-evidence";
export type { WrapWindow as Window } from "../../lib/wrap-evidence";
export default function Wraps({
  windows,
  market,
}: {
  windows: Window[];
  market: Market | null;
}) {
  const [choice, setChoice] = useState(0);
  const selected = windows[choice];
  if (!selected)
    return <p className="empty-state">Ainda não há períodos disponíveis.</p>;
  return (
    <>
      <label className="period-picker">
        Período
        <select
          value={choice}
          onChange={(e) => setChoice(Number(e.target.value))}
        >
          {windows.map((w, index) => (
            <option key={`${w.period_type}-${w.starts_on}`} value={index}>
              {w.period_type === "weekly" ? "Semana" : "Mês"} ·{" "}
              {date(w.starts_on)} a {date(w.ends_on)}
            </option>
          ))}
        </select>
      </label>
      <WrapDetail
        key={`${selected.period_type}-${selected.starts_on}`}
        selected={selected}
        market={market}
      />
    </>
  );
}
function WrapDetail({
  selected,
  market,
}: {
  selected: Window;
  market: Market | null;
}) {
  const now = useClock();
  const { client } = useAccount();
  const load = useCallback(async () => {
    const { data, error } = await client!.rpc("get_market_period_evidence", {
      starts_on: selected.starts_on,
      ends_on: selected.ends_on,
      requested_kind: selected.period_type,
    });
    if (error) throw error;
    return data as Evidence;
  }, [client, selected]);
  const state = useResource(load);
  const evidence = state.data;
  const verifiedRows = wrapRows(
    evidence,
    selected,
    market?.securities || [],
    now,
  );
  const valid = verifiedRows !== null;
  const rows = verifiedRows || [];

  return (
    <>
      <ResourceState {...state} retry={state.reload} />
      {!state.loading &&
        !state.error &&
        (!valid ? (
          <ResourceState
            loading={false}
            error="A evidência verificada deste período não está disponível."
            retry={state.reload}
          />
        ) : (
          <section className="public-section dashboard-panel">
            <div className="section-title">
              <h2>
                {date(selected!.starts_on)} — {date(selected!.ends_on)}
              </h2>
              <span className="fine-print">
                Base: {date(evidence!.baseline_day)}
              </span>
            </div>
            {rows.length ? (
              <>
                <WrapStories
                  rows={rows}
                  period={selected}
                  baseline={evidence!.baseline_day!}
                />
                <div className="metric-grid">
                  <div>
                    <span>Instrumentos com base comparável</span>
                    <strong>{rows.length}</strong>
                  </div>
                  <div>
                    <span>Valorizações de preço</span>
                    <strong className="positive">
                      {rows.filter((r) => r.change > 0).length}
                    </strong>
                  </div>
                  <div>
                    <span>Desvalorizações de preço</span>
                    <strong className="negative">
                      {rows.filter((r) => r.change < 0).length}
                    </strong>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Instrumento</th>
                        <th>Variação no período</th>
                        <th>Fecho inicial</th>
                        <th>Fecho final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.security.id}>
                          <td>
                            <Link href={`/mercado/${row.security.id}`}>
                              {row.security.symbol}
                            </Link>
                          </td>
                          <td
                            className={
                              row.change >= 0 ? "positive" : "negative"
                            }
                          >
                            {number(row.change)}%
                          </td>
                          <td>{priceText(row.security, row.start)}</td>
                          <td>{priceText(row.security, row.end)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="empty-state">
                Não há pares de fechos verificados suficientes para este
                período.
              </p>
            )}
            <p className="data-note">
              Variações de preço entre a sessão de base e a última sessão do
              período. Instrumentos sem ambas as referências são excluídos. Não
              representa rendibilidade total, dividendos ou cupões.
            </p>
            <details>
              <summary>Dados e fontes</summary>
              <p className="fine-print">
                Recolha: {date(evidence!.fetched_at, true)} · Contrato de
                evidência {evidence!.contract_version} · Calendário BODIVA
                verificado.
              </p>
              {rows.map((row) => (
                <p className="fine-print" key={row.security.id}>
                  {row.security.symbol}: {row.records.join(" → ")}
                </p>
              ))}
            </details>
          </section>
        ))}
    </>
  );
}
