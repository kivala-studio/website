"use client";
import { useState } from "react";
import { useAccount } from "../components/account-provider";
import { Feedback } from "../components/async-state";
import { watchlist } from "../../lib/account-data";
import type { Security } from "../../lib/public-data";
export default function Onboarding({ securities }: { securities: Security[] }) {
  const { user, client } = useAccount();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(
    String(
      user?.user_metadata.investao_display_name ||
        user?.user_metadata.full_name ||
        "",
    ),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || user?.user_metadata.investao_onboarding_completed === true)
    return null;
  async function next(skip: boolean) {
    setBusy(true);
    setError("");
    try {
      const { data, error: authError } = await client!.auth.getUser();
      if (authError || data.user?.id !== user!.id)
        throw new Error("Session changed");
      if (step === 0) {
        const { error } = await client!.auth.updateUser({
          data: {
            investao_display_name: skip ? "" : name.trim(),
            investao_name_skipped: skip || !name.trim(),
            investao_onboarding_completed: false,
          },
        });
        if (error) throw error;
        setStep(1);
      } else {
        if (!skip && selected.length) {
          const existing = await watchlist(client!, user!.id);
          const added = selected.filter(
            (id) => !existing.some((w) => w.security_id === id),
          );
          const order = Math.max(-1, ...existing.map((w) => w.sort_order));
          if (added.length) {
            const { error } = await client!.from("watchlist_items").upsert(
              added.map((id, i) => ({
                user_id: user!.id,
                security_id: id,
                sort_order: order + i + 1,
                automatic_alerts_enabled: true,
              })),
              { onConflict: "user_id,security_id", ignoreDuplicates: true },
            );
            if (error) throw error;
          }
        }
        const { error } = await client!.auth.updateUser({
          data: { investao_onboarding_completed: true },
        });
        if (error) throw error;
        setDismissed(true);
      }
    } catch {
      setError(
        "Não foi possível guardar. Tenta novamente; os instrumentos já existentes mantêm-se na tua lista.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="dashboard-panel onboarding-panel">
      <p className="eyebrow">O TEU ESPAÇO · {step + 1} DE 2</p>
      <h2>
        {step === 0 ? "Como te devemos chamar?" : "O que queres acompanhar?"}
      </h2>
      <p>
        {step === 0
          ? "Personaliza o teu perfil. O nome acompanha-te na app e na web."
          : "Escolhe os primeiros instrumentos da tua lista. Podes alterar tudo mais tarde."}
      </p>
      {step === 0 ? (
        <label>
          Nome
          <input
            maxLength={80}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </label>
      ) : (
        <>
          <label>
            Pesquisar instrumentos
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <fieldset disabled={busy} className="onboarding-options">
            {securities
              .filter((s) =>
                `${s.symbol} ${s.name}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .slice(0, 40)
              .map((s) => (
                <label className="toggle-row" key={s.id}>
                  <span>
                    <strong>{s.symbol}</strong>
                    <small>{s.name}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, s.id]
                          : selected.filter((id) => id !== s.id),
                      )
                    }
                  />
                </label>
              ))}
          </fieldset>
          <p className="fine-print">{selected.length} seleccionados</p>
        </>
      )}
      <Feedback error={error} />
      <div className="instrument-actions">
        {step === 1 && (
          <button
            disabled={busy}
            className="secondary-button"
            onClick={() => setStep(0)}
          >
            Voltar
          </button>
        )}
        <button
          disabled={busy}
          className="primary-button"
          onClick={() => next(false)}
        >
          {busy ? "A guardar…" : step === 0 ? "Continuar" : "Concluir"}
        </button>
        <button
          disabled={busy}
          className="text-button"
          onClick={() => next(true)}
        >
          Saltar este passo
        </button>
      </div>
    </section>
  );
}
