"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAccount } from "../components/account-provider";
import {
  Feedback,
  ResourceState,
  useResource,
} from "../components/async-state";
import type { Security } from "../../lib/public-data";
import type { Rule } from "../../lib/account-data";
import { priceText, number } from "../../lib/market-presentation";
const labels = {
  price_above: "Preço acima de",
  price_below: "Preço abaixo de",
  percent_change_above: "Movimento superior a",
};
export default function Alerts({
  securities,
  initial,
}: {
  securities: Security[];
  initial?: string;
}) {
  const { client, user } = useAccount();
  const load = useCallback(async () => {
    const rows: Rule[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client!
        .from("notification_rules")
        .select("id,security_id,kind,threshold,is_enabled,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  }, [client, user]);
  const state = useResource(load);
  const [security, setSecurity] = useState(
    securities.some((s) => s.id === initial) ? initial! : "",
  );
  const [kind, setKind] = useState<Rule["kind"]>("price_above");
  const [threshold, setThreshold] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function mutate(fn: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError("");
    try {
      const { error } = await fn();
      if (error) throw error;
      await state.reload();
      return true;
    } catch {
      setError("Não foi possível guardar o alerta. Tenta novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Feedback error={error} />
      <div className="split-layout">
        <section>
          <ResourceState {...state} retry={state.reload} />
          {state.data?.length === 0 && (
            <div className="empty-state">
              <h2>O que queres acompanhar?</h2>
              <p>
                Cria o teu primeiro alerta. Podes pausá-lo ou ajustá-lo a
                qualquer momento.
              </p>
            </div>
          )}
          {state.data?.map((rule) => {
            const s = securities.find((s) => s.id === rule.security_id);
            return (
              <article className="alert-row" key={rule.id}>
                <div>
                  <Link href={`/mercado/${rule.security_id}`}>
                    <h3>{s?.symbol || "Instrumento"}</h3>
                  </Link>
                  <p>
                    {labels[rule.kind] || rule.kind}{" "}
                    <strong>
                      {rule.kind === "percent_change_above"
                        ? `${number(rule.threshold)}%`
                        : s
                          ? priceText(s, rule.threshold)
                          : number(rule.threshold)}
                    </strong>
                  </p>
                  <span className="status-pill">
                    {rule.is_enabled ? "Activo" : "Em pausa"}
                  </span>
                </div>
                <div className="row-actions">
                  <button
                    disabled={busy}
                    onClick={() =>
                      mutate(() =>
                        client!
                          .from("notification_rules")
                          .update({ is_enabled: !rule.is_enabled })
                          .eq("user_id", user!.id)
                          .eq("id", rule.id),
                      )
                    }
                  >
                    {rule.is_enabled ? "Pausar" : "Activar"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setEditing(rule.id);
                      setSecurity(rule.security_id);
                      setKind(rule.kind);
                      setThreshold(String(rule.threshold));
                      document
                        .getElementById("alert-form")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Editar
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Eliminar este alerta?"))
                        void mutate(() =>
                          client!
                            .from("notification_rules")
                            .delete()
                            .eq("user_id", user!.id)
                            .eq("id", rule.id),
                        );
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            );
          })}
        </section>
        <form
          id="alert-form"
          className="form-panel sticky-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!Number.isFinite(Number(threshold)) || Number(threshold) <= 0) {
              setError("Introduz um valor positivo.");
              return;
            }
            const values = {
              security_id: security,
              kind,
              threshold: Number(threshold),
            };
            const success = await mutate(() =>
              editing
                ? client!
                    .from("notification_rules")
                    .update(values)
                    .eq("user_id", user!.id)
                    .eq("id", editing)
                : client!
                    .from("notification_rules")
                    .insert({ ...values, user_id: user!.id, is_enabled: true }),
            );
            if (success) {
              setEditing(null);
              setThreshold("");
            }
          }}
        >
          <h2>{editing ? "Editar alerta" : "Criar alerta"}</h2>
          <label>
            Instrumento
            <select
              required
              value={security}
              onChange={(e) => setSecurity(e.target.value)}
            >
              <option value="">Seleccionar instrumento</option>
              {securities.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.symbol} · {s.issuers?.name || s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Condição
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Rule["kind"])}
            >
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {kind === "percent_change_above"
              ? "Variação (%)"
              : "Preço alvo (unidade da cotação)"}
            <input
              required
              type="number"
              min="0.00000001"
              step="any"
              max="1000000000000"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </label>
          <button
            className="primary-button"
            disabled={busy || !securities.length}
          >
            {busy ? "A guardar…" : "Guardar alerta"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setThreshold("");
              }}
            >
              Cancelar edição
            </button>
          )}
          <p className="fine-print">
            As obrigações são cotadas em percentagem. Os acontecimentos ficam
            disponíveis na Actividade; as notificações push dependem dos
            dispositivos registados.
          </p>
        </form>
      </div>
    </>
  );
}
