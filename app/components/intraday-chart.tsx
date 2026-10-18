"use client";
import { useCallback } from "react";
import { useAccount } from "./account-provider";
import AccountGate from "./account-gate";
import { useResource, ResourceState } from "./async-state";
import LineChart from "./line-chart";
import type { Security } from "../../lib/public-data";
import { date, kind } from "../../lib/market-presentation";
type Intraday = {
  status: string;
  session_date: string;
  last_checked_at: string | null;
  last_trade_at: string | null;
  points: { bucket_at: string; close_price: number; volume: number | null }[];
};
export default function IntradayChart({ security }: { security: Security }) {
  return (
    <AccountGate feature="O gráfico intradiário">
      <SessionChart security={security} />
    </AccountGate>
  );
}
function SessionChart({ security }: { security: Security }) {
  const { client } = useAccount();
  const load = useCallback(async () => {
    const { data, error } = await client!.rpc("get_intraday_chart", {
      requested_security_id: security.id,
    });
    if (error) throw error;
    return data as Intraday;
  }, [client, security.id]);
  const state = useResource(load);
  const points = (state.data?.points || [])
    .filter(
      (p) =>
        Number.isFinite(p.close_price) &&
        p.close_price > 0 &&
        Number.isFinite(Date.parse(p.bucket_at)),
    )
    .map((p) => ({
      x: Date.parse(p.bucket_at),
      y: p.close_price,
      label: date(p.bucket_at, true),
    }));
  return (
    <>
      <ResourceState {...state} retry={state.reload} />
      {state.data && (
        <>
          <p className="data-note">
            Sessão: {date(state.data.session_date)} · Última verificação:{" "}
            {date(state.data.last_checked_at, true)}.{" "}
            {state.data.status === "live" || state.data.status === "current"
              ? "Dados da sessão."
              : "Referência da sessão disponível, sem garantia de actualidade."}
          </p>
          <LineChart
            label={`Negócios intradiários de ${security.symbol}`}
            unit={
              kind(security).startsWith("Obrigações")
                ? "%"
                : ` ${security.currency === "AOA" ? "Kz" : security.currency}`
            }
            series={[
              { label: security.symbol, color: "var(--accent)", points },
            ]}
          />
          <button
            className="text-button"
            disabled={state.loading}
            onClick={state.reload}
          >
            Actualizar sessão
          </button>
        </>
      )}
    </>
  );
}
