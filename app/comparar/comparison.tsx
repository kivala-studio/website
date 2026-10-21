"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAccount } from "../components/account-provider";
import { usePersonalisation } from "../components/personalisation-provider";
import type { Security } from "../../lib/public-data";
import type { HistoryPoint } from "../../lib/history";
import { date, kind } from "../../lib/market-presentation";
import {
  getSubscriptionAccess,
  prepareComparison,
  subscriptionMessage,
  type SubscriptionAccess,
} from "../../lib/subscriptions";
import { ranges, fetchHistory } from "../components/history-chart";
import { ResourceState, useResource } from "../components/async-state";
import LineChart from "../components/line-chart";

type Confirmed = {
  first: Security;
  second: Security;
  histories: HistoryPoint[][];
  access: SubscriptionAccess;
};
export default function Comparison({ securities }: { securities: Security[] }) {
  const { record } = usePersonalisation();
  const { client, user } = useAccount();
  const loadAccess = useCallback(async () => {
    if (!client || !user) throw new Error("COMPARISON_SIGN_IN_REQUIRED");
    return getSubscriptionAccess(client);
  }, [client, user]);
  const state = useResource(loadAccess);
  const preferred = securities.filter((s) => kind(s) === "Acções");
  const [first, setFirst] = useState(
    preferred[0]?.id || securities[0]?.id || "",
  );
  const [second, setSecond] = useState(
    preferred[1]?.id || securities[1]?.id || "",
  );
  const [range, setRange] = useState<keyof typeof ranges>("1A");
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const access = confirmed?.access || state.data;
  function choose(update: () => void) {
    update();
    setConfirmed(null);
    setError("");
  }
  const periods = (
    <div className="period-tabs">
      {Object.keys(ranges).map((key) => (
        <button
          key={key}
          disabled={busy}
          aria-pressed={range === key}
          onClick={() => {
            setRange(key as keyof typeof ranges);
            setError("");
          }}
        >
          {key}
        </button>
      ))}
    </div>
  );
  async function compare() {
    if (!client || !user || busy) return;
    setBusy(true);
    setError("");
    setConfirmed(null);
    try {
      const a = securities.find((s) => s.id === first);
      const b = securities.find((s) => s.id === second);
      if (!a || !b || kind(a) !== kind(b))
        throw new Error("INVALID_COMPARISON");
      const cutoff = ranges[range] ? Date.now() - ranges[range] * 86400000 : 0;
      const result = await prepareComparison(
        client,
        user.id,
        [first, second],
        fetchHistory,
        cutoff,
      );
      setConfirmed({ first: a, second: b, ...result });
      record({ kind: "comparison", securityID: first, relatedID: second });
    } catch (cause) {
      setError(subscriptionMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ResourceState {...state} retry={state.reload} />
      {access && (
        <aside className="subscription-notice">
          <strong>
            {access.is_plus
              ? "Plus · sem limite semanal"
              : "Gratuito · um par de dois instrumentos por semana"}
          </strong>
          <p>
            Podes reabrir o mesmo par e alterar o período. A confirmação só
            utiliza a comparação quando existem dois fechos comuns no período
            seleccionado.
          </p>
          {!access.is_plus && access.comparison_pair && (
            <p>Próxima escolha: {date(access.resets_at, true)} · Luanda.</p>
          )}
          {!access.is_plus &&
            access.comparison_pair &&
            access.comparison_pair.every((id) =>
              securities.some((s) => s.id === id),
            ) && (
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() =>
                  choose(() => {
                    setFirst(access.comparison_pair![0]);
                    setSecond(access.comparison_pair![1]);
                  })
                }
              >
                Seleccionar o meu par semanal
              </button>
            )}
          <Link href="/planos">Consultar planos e limites →</Link>
        </aside>
      )}
      <div className="form-grid">
        {[
          ["Primeiro instrumento", first, setFirst] as const,
          ["Segundo instrumento", second, setSecond] as const,
        ].map(([label, value, setter]) => (
          <label key={label}>
            {label}
            <select
              disabled={busy}
              value={value}
              onChange={(e) => choose(() => setter(e.target.value))}
            >
              {securities.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.symbol} · {s.issuers?.name || s.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {periods}
      <button
        className="primary-button"
        type="button"
        disabled={
          busy ||
          state.loading ||
          !!state.error ||
          !first ||
          !second ||
          first === second
        }
        onClick={() => void compare()}
      >
        {busy ? "A confirmar acesso e dados…" : "Comparar este par"}
      </button>
      {first === second && (
        <p className="data-note">Selecciona dois instrumentos diferentes.</p>
      )}
      {error && (
        <div className="subscription-notice" role="alert">
          <p>{error}</p>
          <Link href="/planos">Conhecer os planos →</Link>
        </div>
      )}
      {confirmed && (
        <CompareChart
          first={confirmed.first}
          second={confirmed.second}
          histories={confirmed.histories}
          range={range}
        />
      )}
    </>
  );
}
function CompareChart({
  first,
  second,
  histories,
  range,
}: {
  first: Security;
  second: Security;
  histories: HistoryPoint[][];
  range: keyof typeof ranges;
}) {
  const [asOf] = useState(() => Date.now());
  const cutoff = ranges[range] ? asOf - ranges[range] * 86400000 : 0;
  const a = histories[0].filter((p) => Date.parse(p.trading_date) >= cutoff);
  const b = histories[1].filter((p) => Date.parse(p.trading_date) >= cutoff);
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
      {common.length >= 2 ? (
        <LineChart
          series={series}
          label={`Comparação de ${first.symbol} e ${second.symbol}`}
          unit="%"
        />
      ) : (
        <p className="empty-state">
          Não existem duas datas com fechos para ambos os instrumentos neste
          período. Podes alterar o período sem escolher outro par.
        </p>
      )}
      <p className="data-note">
        Compara apenas variação de preço nas datas com observações para ambos os
        instrumentos. Não inclui dividendos, cupões, taxas ou conversão cambial.
        A variação de preço de uma obrigação não é a sua rendibilidade.
      </p>
    </section>
  );
}
