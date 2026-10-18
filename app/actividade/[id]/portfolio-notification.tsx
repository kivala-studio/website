"use client";
import Link from "next/link";
import { useCallback } from "react";
import { useAccount } from "../../components/account-provider";
import { useResource, ResourceState } from "../../components/async-state";
import { useClock } from "../../components/use-clock";
import { notificationEvidence } from "../../../lib/notification-evidence";
import { date, number } from "../../../lib/market-presentation";

export default function PortfolioNotification({ id }: { id: string }) {
  const { client, privateMode } = useAccount();
  const now = useClock();
  const load = useCallback(async () => {
    const { data, error } = await client!.rpc(
      "get_portfolio_notification_evidence",
      { notification_id: id },
    );
    if (error) throw error;
    if (notificationEvidence(data)) {
      // Read acknowledgement is independent of evidence availability.
      await client!.rpc("acknowledge_account_notifications", {
        notification_ids: [id],
        opened: true,
      });
    }
    return { evidence: data as unknown };
  }, [client, id]);
  const state = useResource(load);
  const evidence =
    !state.error && notificationEvidence(state.data?.evidence, now);
  const money = (value: string) =>
    privateMode ? "••••" : `${number(Number(value))} Kz`;
  return (
    <>
      <ResourceState {...state} retry={state.reload} />
      {!state.loading && !state.error && !evidence && (
        <div className="empty-state">
          <h2>Detalhes indisponíveis.</h2>
          <p>
            Este registo expirou, foi retirado ou já não tem informação
            completa. Consulta a tua carteira para os valores actuais.
          </p>
        </div>
      )}
      {evidence && (
        <>
          <section className="dashboard-panel">
            <p className="eyebrow">
              {date(evidence.baselineDate)} — {date(evidence.tradingDate)}
            </p>
            <h2>
              {money(evidence.change)}{" "}
              <small>
                {privateMode
                  ? "••••"
                  : `(${number(Number(evidence.percentage))}%)`}
              </small>
            </h2>
            <p>
              De {money(evidence.startValue)} para {money(evidence.endValue)}.
            </p>
            <p className="muted">
              Variação de preços nas posições mantidas durante este intervalo,
              sem compras ou vendas. Não inclui dividendos, juros, impostos ou
              comissões.
            </p>
          </section>
          {privateMode ? (
            <p className="empty-state">
              Os valores e as posições estão ocultos pelo modo privado.
            </p>
          ) : (
            <>
              <section className="dashboard-panel">
                <h2>Contributo de cada posição</h2>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Instrumento</th>
                        <th>Quantidade</th>
                        <th>Valor inicial</th>
                        <th>Valor final</th>
                        <th>Variação</th>
                        <th>Contributo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...evidence.positions]
                        .sort(
                          (a, b) =>
                            Number(b.contribution) - Number(a.contribution) ||
                            a.assetID.localeCompare(b.assetID),
                        )
                        .map((p) => (
                          <tr key={p.assetID}>
                            <td>
                              <Link href={`/mercado/${p.assetID}`}>
                                {p.symbol}
                              </Link>
                            </td>
                            <td>{number(Number(p.quantity))}</td>
                            <td>{money(p.startValue)}</td>
                            <td>{money(p.endValue)}</td>
                            <td>{money(p.contribution)}</td>
                            <td>{number(Number(p.percentagePoints))} pp</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <details className="dashboard-panel">
                <summary>Fontes e cálculo</summary>
                <p>
                  Guardado em {date(evidence.generatedAt, true)} · Luanda.
                  Cálculo v{evidence.calculationVersion}; calendário{" "}
                  {evidence.calendarVersion}.
                </p>
                <p>
                  Preços de fecho BODIVA. O contributo em pontos percentuais
                  divide a variação da posição pelo valor inicial de toda a
                  carteira.
                </p>
                {evidence.positions.map((p) => (
                  <div key={p.assetID} className="notification-provenance">
                    <h3>{p.symbol}</h3>
                    <p>
                      {date(evidence.baselineDate)}: {money(p.startPrice)} ·
                      recolhido {date(p.startCollectedAt, true)}
                      <br />
                      Registo: <code>{p.startRecordID}</code> · Recolha:{" "}
                      <code>{p.startRunID}</code>
                    </p>
                    <p>
                      {date(evidence.tradingDate)}: {money(p.endPrice)} ·
                      recolhido {date(p.endCollectedAt, true)}
                      <br />
                      Registo: <code>{p.endRecordID}</code> · Recolha:{" "}
                      <code>{p.endRunID}</code>
                    </p>
                  </div>
                ))}
              </details>
            </>
          )}
        </>
      )}
      <div className="row-actions">
        <Link className="secondary-button" href="/carteira">
          Ver carteira actual
        </Link>
        <button
          className="text-button"
          onClick={state.reload}
          disabled={state.loading}
        >
          Actualizar registo
        </button>
      </div>
    </>
  );
}
