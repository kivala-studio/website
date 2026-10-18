"use client";
import { useCallback, useState } from "react";
import { useAccount } from "../components/account-provider";
import {
  Feedback,
  ResourceState,
  useResource,
} from "../components/async-state";
const categories = {
  watched_movements_enabled: "Movimentos da minha lista",
  held_asset_movements_enabled: "Movimentos dos activos em carteira",
  portfolio_daily_enabled: "Resumo diário da carteira",
  listings_enabled: "Novas admissões à BODIVA",
  public_previews_enabled: "Mostrar pré-visualizações nas notificações",
};
type Preferences = Record<keyof typeof categories, boolean>;
export function SettingsPanel() {
  const { client, user } = useAccount();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const results = await Promise.all([
      client!
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle(),
      client!
        .from("user_recap_preferences")
        .select("enabled")
        .eq("user_id", user!.id)
        .maybeSingle(),
      client!
        .from("user_movement_preferences")
        .select("sensitivity")
        .eq("user_id", user!.id)
        .maybeSingle(),
    ]);
    for (const result of results) if (result.error) throw result.error;
    return {
      preferences: results[0].data as Preferences | null,
      recap: !!results[1].data?.enabled,
      sensitivity: String(results[2].data?.sensitivity || "normal"),
    };
  }, [client, user]);
  const state = useResource(load);
  async function save(task: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError("");
    try {
      const { error } = await task();
      if (error) throw error;
      await state.reload();
    } catch {
      setError("Não foi possível guardar as preferências.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-panel">
      <h2>Notificações e preferências</h2>
      <p>
        Estas preferências são partilhadas com a app. Consulta as notificações
        na página Actividade.
      </p>
      <ResourceState {...state} retry={state.reload} />
      {state.data && (
        <fieldset disabled={busy || state.loading}>
          {Object.entries(categories).map(([key, title]) => (
            <label className="toggle-row" key={key}>
              <span>{title}</span>
              <input
                type="checkbox"
                checked={
                  state.data!.preferences?.[key as keyof Preferences] ?? true
                }
                onChange={(e) =>
                  save(() =>
                    client!
                      .from("notification_preferences")
                      .upsert(
                        { user_id: user!.id, [key]: e.target.checked },
                        { onConflict: "user_id" },
                      ),
                  )
                }
              />
            </label>
          ))}
          <label className="toggle-row">
            <span>Receber resumo do mercado</span>
            <input
              type="checkbox"
              checked={state.data.recap}
              onChange={(e) =>
                save(() =>
                  client!.rpc("set_market_recap_preference", {
                    wants_recaps: e.target.checked,
                  }),
                )
              }
            />
          </label>
          <label>
            Sensibilidade dos alertas automáticos
            <select
              value={state.data.sensitivity}
              onChange={(e) =>
                save(() =>
                  client!
                    .from("user_movement_preferences")
                    .upsert(
                      { user_id: user!.id, sensitivity: e.target.value },
                      { onConflict: "user_id" },
                    ),
                )
              }
            >
              <option value="low">Baixa</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
            </select>
          </label>
        </fieldset>
      )}
      <Feedback error={error} />
    </section>
  );
}
