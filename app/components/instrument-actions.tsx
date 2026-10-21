"use client";
import Link from "./workspace-link";
import { useCallback, useState } from "react";
import { useAccount } from "./account-provider";
import { useResource, Feedback } from "./async-state";
import { subscriptionMessage } from "../../lib/subscriptions";
export default function InstrumentActions({ id }: { id: string }) {
  const { user } = useAccount();
  return (
    <div className="instrument-actions">
      {user ? (
        <WatchButton key={`${user.id}-${id}`} id={id} />
      ) : (
        <Link className="primary-button" href={`/lista?instrumento=${id}`}>
          Entrar para guardar na minha lista
        </Link>
      )}
      <Link className="secondary-button" href={`/alertas?instrumento=${id}`}>
        Criar alerta
      </Link>
      <Link className="secondary-button" href="/comparar">
        Comparar
      </Link>
      <Link className="secondary-button" href="/simular">
        Simular investimento
      </Link>
    </div>
  );
}
function WatchButton({ id }: { id: string }) {
  const { client, user } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const { data, error } = await client!
      .from("watchlist_items")
      .select("security_id")
      .eq("user_id", user!.id)
      .eq("security_id", id)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }, [client, user, id]);
  const state = useResource(load);
  return (
    <div>
      <button
        className="primary-button"
        disabled={state.loading || busy || !!state.error}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            if (state.data) {
              const { error } = await client!
                .from("watchlist_items")
                .delete()
                .eq("user_id", user!.id)
                .eq("security_id", id);
              if (error) throw error;
            } else {
              const { data, error } = await client!
                .from("watchlist_items")
                .select("sort_order")
                .eq("user_id", user!.id)
                .order("sort_order", { ascending: false })
                .limit(1);
              if (error) throw error;
              const result = await client!.from("watchlist_items").insert({
                user_id: user!.id,
                security_id: id,
                sort_order: (data[0]?.sort_order ?? -1) + 1,
              });
              if (result.error) throw result.error;
            }
            await state.reload();
          } catch (cause) {
            setError(subscriptionMessage(cause));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy || state.loading
          ? "A actualizar…"
          : state.data
            ? "Guardado · remover da lista"
            : "+ Guardar na minha lista"}
      </button>
      <Feedback error={error || state.error} />
      {error && (
        <Link className="text-button" href="/planos">
          Consultar planos
        </Link>
      )}
      {state.error && <button onClick={state.reload}>Tentar novamente</button>}
    </div>
  );
}
