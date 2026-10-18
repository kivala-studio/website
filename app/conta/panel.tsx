"use client";
import { useEffect, useState } from "react";
import { useAccount } from "../components/account-provider";
import { Feedback } from "../components/async-state";
import { useRouter, useSearchParams } from "next/navigation";
import { returnPath, needsOnboarding } from "../../lib/navigation";
import Onboarding from "./onboarding";
import type { Security } from "../../lib/public-data";
import Icon from "../components/invest-icon";
import { SettingsPanel } from "./settings";

export default function AccountPanel({
  securities,
}: {
  securities: Security[];
}) {
  const { client, user, loading } = useAccount();
  const router = useRouter();
  const params = useSearchParams();
  const next = returnPath(params.get("next"));
  const callback = `/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  useEffect(() => {
    if (user && !needsOnboarding(user) && next) router.replace(next);
  }, [user, next, router]);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch {
      setError(
        "Não foi possível concluir. Verifica os dados e tenta novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">A recuperar sessão…</p>;
  if (!client)
    return (
      <div className="empty-state">
        O acesso à conta está temporariamente indisponível. Podes continuar a
        explorar o mercado.
      </div>
    );
  if (user)
    return (
      <div key={user.id}>
        {needsOnboarding(user) ? (
          <Onboarding securities={securities} />
        ) : (
          <Profile />
        )}
      </div>
    );
  return (
    <div className="auth-layout">
      <section className="form-panel">
        <p className="eyebrow">BEM-VINDO À INVEST.AO</p>
        <h2>Entra no teu mercado.</h2>
        <p>Usa o mesmo método de acesso da app para recuperar os teus dados.</p>
        <div className="oauth-buttons">
          {(["google", "apple"] as const).map((provider) => (
            <button
              className="secondary-button"
              key={provider}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { error } = await client.auth.signInWithOAuth({
                    provider,
                    options: { redirectTo: `${location.origin}${callback}` },
                  });
                  if (error) throw error;
                })
              }
            >
              Continuar com {provider === "google" ? "Google" : "Apple"}
            </button>
          ))}
        </div>
        <div className="form-divider">ou com o teu email</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (sent) {
                const { error } = await client.auth.verifyOtp({
                  email,
                  token: code,
                  type: "email",
                });
                if (error) throw error;
              } else {
                const { error } = await client.auth.signInWithOtp({
                  email,
                  options: {
                    emailRedirectTo: `${location.origin}${callback}`,
                  },
                });
                if (error) throw error;
                setSent(true);
                setMessage(
                  "Enviámos um email. Abre a ligação neste navegador ou introduz o código, se incluído.",
                );
              }
            });
          }}
        >
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              disabled={sent || busy}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {sent && (
            <label>
              Código de acesso
              <input
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          )}
          <button className="primary-button" disabled={busy}>
            {busy
              ? "A processar…"
              : sent
                ? "Confirmar código"
                : "Enviar acesso por email"}
          </button>
          {sent && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setSent(false);
                setCode("");
              }}
            >
              Usar outro email / reenviar
            </button>
          )}
        </form>
        <Feedback error={error} message={message} />
        <p className="fine-print">
          Ao continuar, podes criar uma conta ou entrar numa conta existente.
          Consulta a <a href="/policy">política de privacidade</a>.
        </p>
      </section>
      <aside className="auth-story">
        <Icon name="markets" size={48} />
        <h2>
          Mais perto
          <br />
          dos teus investimentos.
        </h2>
        <p>
          Uma lista que se mantém contigo.
          <br />
          Uma carteira com contexto.
          <br />
          Alertas para o que importa.
        </p>
        <small>SEM INSTALAR. SEM PERDER O CONTEXTO.</small>
      </aside>
    </div>
  );
}
function Profile() {
  const {
    config,
    client,
    user,
    privateMode,
    setPrivateMode,
    appearance,
    setAppearance,
  } = useAccount();
  const [name, setName] = useState(
    String(
      user?.user_metadata.investao_display_name ||
        user?.user_metadata.full_name ||
        "",
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState("");
  async function action(fn: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(success);
    } catch {
      setError("Não foi possível guardar a alteração. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-layout">
      <section className="form-panel">
        <h2>Perfil</h2>
        <p>{user?.email}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              const { error } = await client!.auth.updateUser({
                data: {
                  investao_display_name: name.trim(),
                  investao_name_skipped: !name.trim(),
                  investao_onboarding_completed: true,
                },
              });
              if (error) throw error;
            }, "Perfil guardado.");
          }}
        >
          <label>
            Como te devemos chamar?
            <input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <button className="primary-button" disabled={busy}>
            Guardar perfil
          </button>
        </form>
        <label>
          Aparência
          <select
            value={appearance}
            onChange={(e) => setAppearance(e.target.value)}
          >
            <option value="system">Sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
          </select>
        </label>
        <label className="toggle-row">
          <span>Ocultar valores pessoais neste navegador</span>
          <input
            type="checkbox"
            checked={privateMode}
            onChange={(e) => setPrivateMode(e.target.checked)}
          />
        </label>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() =>
            action(async () => {
              const { error } = await client!.auth.signOut();
              if (error) throw error;
            }, "")
          }
        >
          Terminar sessão
        </button>
        <Feedback error={error} message={message} />
      </section>
      <SettingsPanel />
      <section className="form-panel danger-panel">
        <h2>Eliminar conta</h2>
        <p>
          Remove definitivamente a conta, lista, alertas e registos de carteira.
          Esta operação não pode ser anulada.
        </p>
        <label>
          Escreve ELIMINAR para confirmar
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          className="danger-button"
          disabled={confirm !== "ELIMINAR" || busy}
          onClick={() =>
            action(async () => {
              const {
                data: { session },
              } = await client!.auth.getSession();
              if (!session || session.user.id !== user!.id || !config)
                throw new Error("Session changed");
              const { data: verified, error: authError } =
                await client!.auth.getUser(session.access_token);
              if (authError || verified.user?.id !== user!.id)
                throw new Error("Session changed");
              const apple = verified.user.identities?.some(
                (identity) => identity.provider === "apple",
              );
              // Keep deletion bound to the credential of the explicitly confirmed account.
              const response = await fetch(
                apple
                  ? "/api/account/apple-deletion"
                  : `${config.url}/rest/v1/rpc/delete_user_account`,
                {
                  method: "POST",
                  headers: {
                    apikey: config.key,
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(
                    apple ? { expectedUserID: user!.id } : {},
                  ),
                },
              );
              if (!response.ok) throw new Error("Account deletion unavailable");
              if (apple) {
                const data = await response.json();
                const target = new URL(data.authorizationURL);
                if (
                  target.protocol !== "https:" ||
                  target.hostname !== "appleid.apple.com"
                )
                  throw new Error("Invalid redirect");
                location.assign(target.href);
                return;
              }
              await client!.auth.signOut({ scope: "local" });
            }, "")
          }
        >
          Eliminar definitivamente
        </button>
      </section>
    </div>
  );
}
