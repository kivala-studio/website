"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAccount } from "../components/account-provider";
import {
  Feedback,
  ResourceState,
  useResource,
} from "../components/async-state";
import { watchlist, type Watch } from "../../lib/account-data";
import type { Market } from "../../lib/public-data";
import { kind, reading } from "../../lib/market-presentation";
import MarketReading from "../market-reading";
export default function Watchlist({ market }: { market: Market | null }) {
  const { client, user } = useAccount();
  const load = useCallback(() => watchlist(client!, user!.id), [client, user]);
  const state = useResource(load);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState<Watch | null>(null);
  async function mutate(fn: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError("");
    try {
      const { error } = await fn();
      if (error) throw error;
      await state.reload();
      return true;
    } catch {
      setError("Não foi possível actualizar a lista. Tenta novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const ids = new Set(state.data?.map((row) => row.security_id));
  const candidates =
    market?.securities
      .filter(
        (s) =>
          !ids.has(s.id) &&
          `${s.name} ${s.symbol} ${s.issuers?.name || ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
      .slice(0, 12) || [];
  return (
    <>
      <ResourceState {...state} retry={state.reload} />
      <Feedback error={error} />
      {removed && (
        <div className="success-state" role="status">
          Instrumento removido.{" "}
          <button
            disabled={busy}
            onClick={async () => {
              if (
                await mutate(() =>
                  client!
                    .from("watchlist_items")
                    .insert({ ...removed, user_id: user!.id }),
                )
              )
                setRemoved(null);
            }}
          >
            Anular
          </button>
        </div>
      )}
      <div className="split-layout">
        <section>
          <div className="section-title">
            <h2>
              Instrumentos guardados <small>{state.data?.length ?? "—"}</small>
            </h2>
            <button
              className="text-button"
              disabled={busy || state.loading}
              onClick={state.reload}
            >
              Actualizar ↻
            </button>
          </div>
          {state.data?.length === 0 && (
            <div className="empty-state">
              <h3>A tua lista começa aqui.</h3>
              <p>
                Adiciona um instrumento para seguir cotações e activar alertas
                automáticos.
              </p>
            </div>
          )}
          <div className="watch-rows">
            {state.data?.map((row, index) => {
              const s = market?.securities.find(
                (s) => s.id === row.security_id,
              );
              return (
                <article key={row.security_id} className="watch-row">
                  <div className="watch-row-main">
                    <Link href={`/mercado/${row.security_id}`}>
                      <span className="instrument-badge">
                        {s?.symbol.slice(0, 2) || "·"}
                      </span>
                      <div>
                        <h3>{s?.symbol || "Instrumento indisponível"}</h3>
                        <p>{s?.issuers?.name || s?.name || row.security_id}</p>
                      </div>
                    </Link>
                    {s && market && (
                      <MarketReading security={s} value={reading(s, market)} />
                    )}
                  </div>
                  <div className="row-actions">
                    <label>
                      <input
                        type="checkbox"
                        checked={row.automatic_alerts_enabled}
                        disabled={busy}
                        onChange={(e) =>
                          mutate(() =>
                            client!
                              .from("watchlist_items")
                              .update({
                                automatic_alerts_enabled: e.target.checked,
                              })
                              .eq("user_id", user!.id)
                              .eq("security_id", row.security_id),
                          )
                        }
                      />{" "}
                      Alertas automáticos
                    </label>
                    <Link href={`/alertas?instrumento=${row.security_id}`}>
                      Criar alerta
                    </Link>
                    {[-1, 1].map((step) => (
                      <button
                        key={step}
                        disabled={
                          busy ||
                          index + step < 0 ||
                          index + step >= state.data!.length
                        }
                        aria-label={
                          step < 0 ? "Mover para cima" : "Mover para baixo"
                        }
                        onClick={() => {
                          const order = state.data!.map(
                            (item) => item.security_id,
                          );
                          [order[index], order[index + step]] = [
                            order[index + step],
                            order[index],
                          ];
                          void mutate(() =>
                            client!.rpc("reorder_watchlist", {
                              security_ids: order,
                            }),
                          );
                        }}
                      >
                        {step < 0 ? "↑" : "↓"}
                      </button>
                    ))}
                    <button
                      disabled={busy}
                      onClick={async () => {
                        if (
                          await mutate(() =>
                            client!
                              .from("watchlist_items")
                              .delete()
                              .eq("user_id", user!.id)
                              .eq("security_id", row.security_id),
                          )
                        )
                          setRemoved(row);
                      }}
                    >
                      Remover
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <aside className="form-panel sticky-panel">
          <p className="eyebrow">DESCOBRIR</p>
          <h2>Adicionar à lista</h2>
          <label>
            Pesquisar instrumento
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Símbolo ou nome"
            />
          </label>
          {!market && (
            <p role="alert">
              O catálogo está indisponível. Actualiza a página para tentar
              novamente.
            </p>
          )}
          <div className="picker-results">
            {candidates.map((s) => (
              <div key={s.id}>
                <div>
                  <strong>{s.symbol}</strong>
                  <p>{kind(s)}</p>
                </div>
                <button
                  className="add-button"
                  aria-label={`Adicionar ${s.symbol}`}
                  disabled={busy || state.loading || !!state.error}
                  onClick={() =>
                    mutate(() =>
                      client!.from("watchlist_items").insert({
                        user_id: user!.id,
                        security_id: s.id,
                        sort_order:
                          Math.max(
                            -1,
                            ...state.data!.map((row) => row.sort_order),
                          ) + 1,
                      }),
                    )
                  }
                >
                  +
                </button>
              </div>
            ))}
          </div>
          {market && !candidates.length && (
            <p>Não há instrumentos por adicionar nesta pesquisa.</p>
          )}
        </aside>
      </div>
    </>
  );
}
