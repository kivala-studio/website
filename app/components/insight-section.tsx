"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAccount } from "./account-provider";
import { usePersonalisation } from "./personalisation-provider";
import { CookiePreferencesButton, useCookieConsent } from "./cookie-consent";
import { optionalStorageAllowed } from "../../lib/cookie-consent";
import { useResource, ResourceState, Feedback } from "./async-state";
import { useClock } from "./use-clock";
import Icon from "./invest-icon";
import { loadInsights } from "../../lib/insight-data";
import { readExposure, updateExposure } from "../../lib/content-exposure";
import {
  emptyExposure,
  rankInsights,
  recordExposure,
  recordUsefulness,
  type InsightSurface,
  type Usefulness,
  type Exposure,
} from "../../lib/insight-personalisation";
import { controlEnabled, familyEnabled } from "../../lib/intelligence-controls";
import type { VerifiedInsight } from "../../lib/verified-insights";
import { date } from "../../lib/market-presentation";
let fallbackIdentity: string | undefined;
function identity() {
  if (!optionalStorageAllowed()) return (fallbackIdentity ??= crypto.randomUUID());
  try {
    const key = "investao.intelligence.installation";
    const old = localStorage.getItem(key);
    if (old) return old;
    const value = crypto.randomUUID();
    localStorage.setItem(key, value);
    return value;
  } catch {
    return (fallbackIdentity ??= crypto.randomUUID());
  }
}
export default function InsightSection({
  surface,
  revision = "",
}: {
  surface: InsightSurface;
  revision?: string;
}) {
  const { user, privateMode } = useAccount();
  const { optional } = useCookieConsent();
  if (!user) return null;
  if (privateMode)
    return (
      <section className="insight-section">
        <p className="fine-print">
          Observações pessoais ocultas no modo privado.
        </p>
      </section>
    );
  return (
    <Session key={`${user.id}:${surface}:${revision}:${optional}`} surface={surface} />
  );
}
function Session({ surface }: { surface: InsightSurface }) {
  const { client, user, privateMode } = useAccount(),
    { profile } = usePersonalisation(),
    now = useClock();
  const lifetime = useRef({ active: true });
  useEffect(() => {
    const token = lifetime.current;
    token.active = true;
    return () => {
      token.active = false;
    };
  }, []);
  const [message, setMessage] = useState(""),
    [failure, setFailure] = useState("");
  const load = useCallback(async () => {
    const result = await loadInsights(client!, user!.id);
    let exposure: Exposure = emptyExposure(),
      storage = optionalStorageAllowed();
    try {
      exposure = readExposure(user!.id);
    } catch {
      storage = false;
    }
    return { ...result, exposure, storage, identity: identity() };
  }, [client, user]);
  const state = useResource(load);
  const { reload } = state;
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) void reload();
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);
  const config = state.data?.controls,
    install = state.data?.identity || "";
  const mode =
    config &&
    (!controlEnabled(config, install, "personalization_engine", now) ||
      (surface === "home" &&
        !controlEnabled(config, install, "personalized_home", now)))
      ? "significance"
      : config && controlEnabled(config, install, "personalization_v2", now)
        ? "v2"
        : "standard";
  const candidates = useMemo(
    () =>
      (state.data?.insights || [])
        .filter((i) => config && familyEnabled(config, install, i.family, now))
        .map((i) => ({
          ...i,
          mandatory:
            surface === "portfolio" && i.family === "portfolioPricePerformance",
        })),
    [state.data, config, install, now, surface],
  );
  const selected = useMemo(
    () =>
      rankInsights(
        candidates,
        surface,
        {
          ...profile,
          held:
            surface === "portfolio"
              ? candidates.flatMap((c) => c.relationshipAssets || c.assets)
              : state.data?.held || [],
          watched: state.data?.watched || [],
        },
        state.data?.exposure || emptyExposure(),
        now,
        surface === "portfolio" ? 10 : 2,
        mode,
      ),
    [candidates, surface, profile, state.data, now, mode],
  );
  async function authorize() {
    const { data } = await client!.auth.getSession();
    return (
      lifetime.current.active &&
      !privateMode &&
      data.session?.user.id === user!.id
    );
  }
  async function record(insight: VerifiedInsight, opened: boolean) {
    if (document.hidden || !optionalStorageAllowed()) return;
    try {
      await updateExposure(user!.id, authorize, (old) =>
        recordExposure(old, insight, opened, Date.now()),
      );
    } catch {
      /* Reading remains available when local optional preferences are unavailable. */
    }
  }
  async function feedback(
    insight: VerifiedInsight,
    scope: Usefulness["scope"] | null,
  ) {
    setMessage("");
    setFailure("");
    try {
      await updateExposure(user!.id, authorize, (old) =>
        recordUsefulness(old, insight, surface, scope, Date.now()),
      );
      if (lifetime.current.active)
        setMessage(
          scope
            ? "Preferência guardada neste navegador. Será aplicada na próxima actualização; eventos de elevada relevância continuam elegíveis."
            : "Preferência reposta para esta observação.",
        );
    } catch {
      if (lifetime.current.active)
        setFailure("Não foi possível guardar a preferência. Tenta novamente.");
    }
  }
  return (
    <section className="insight-section" aria-label="Observações verificadas">
      <div className="section-title">
        <div>
          <p className="eyebrow">O TEU MERCADO, COM CONTEXTO</p>
          <h2>
            {surface === "portfolio"
              ? "Sobre a tua carteira."
              : surface === "watchlist"
                ? "O que mudou na tua lista."
                : "Para acompanhares de perto."}
          </h2>
        </div>
        <button
          className="text-button"
          disabled={state.loading}
          onClick={state.reload}
        >
          Actualizar observações
        </button>
      </div>
      <ResourceState
        loading={state.loading && !state.data}
        error={state.error}
        retry={state.reload}
      />
      {state.data && !state.error && (
        <>
          <p className="fine-print">
            Semana de {date(state.data.period.starts_on)} a{" "}
            {date(state.data.period.ends_on)} · Fechos verificados, sem
            previsões.
          </p>
          {(state.data.financialUnavailable ||
            (surface === "portfolio" && !state.data.portfolioAvailable)) && (
            <p className="fine-print">
              Não foi possível verificar os dados financeiros desta semana. Não
              apresentamos valores incompletos.
            </p>
          )}
          {state.data.publicationsUnavailable && surface !== "portfolio" && (
            <p className="fine-print">
              As publicações não estão disponíveis nesta actualização.
            </p>
          )}
          {!state.data.storage && (
            <p className="fine-print">
              As preferências locais estão indisponíveis. As observações
              continuam a usar os dados verificados.
            </p>
          )}
          {selected.length ? (
            <div className="insight-grid">
              {selected.map((i) => (
                <InsightCard
                  key={i.id}
                  insight={i}
                  onSeen={() => record(i, false)}
                  onOpen={() => record(i, true)}
                  onFeedback={(scope) => feedback(i, scope)}
                />
              ))}
            </div>
          ) : (
            <p className="empty-state">
              Não há novas observações com evidência suficiente neste momento.
              Os teus registos continuam disponíveis abaixo.
            </p>
          )}
        </>
      )}
      <Feedback message={message} error={failure} />
    </section>
  );
}
export function InsightCard({
  insight,
  onSeen,
  onOpen,
  onFeedback,
}: {
  insight: VerifiedInsight;
  onSeen: () => void;
  onOpen: () => void;
  onFeedback: (scope: Usefulness["scope"] | null) => Promise<void>;
}) {
  const { optional } = useCookieConsent();
  const ref = useRef<HTMLElement | null>(null),
    seen = useRef(false),
    callbacks = useRef({ onSeen });
  useEffect(() => {
    callbacks.current = { onSeen };
  }, [onSeen]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          !seen.current &&
          !document.hidden &&
          entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.6)
        ) {
          seen.current = true;
          callbacks.current.onSeen();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <article className="insight-card" ref={ref}>
      <div className="insight-heading">
        <Icon
          name={insight.category === "portfolio" ? "portfolio" : "watchlist"}
        />
        <span>
          {insight.category === "portfolio" ? "A TUA CARTEIRA" : "A TUA LISTA"}
        </span>
        <time dateTime={new Date(insight.observedAt).toISOString()}>
          {date(new Date(insight.observedAt).toISOString())}
        </time>
      </div>
      <h3>{insight.title}</h3>
      <strong className="insight-value">{insight.value}</strong>
      <p>{insight.body}</p>
      <details
        onToggle={(e) => {
          if (e.currentTarget.open) onOpen();
        }}
      >
        <summary>Sobre esta observação</summary>
        {insight.details.length > 0 && (
          <dl>
            {insight.details.map((item, i) => (
              <div key={`${item.label}:${i}`}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="fine-print">
          Baseada em {insight.recordIDs.length} registos verificados. Dados
          obtidos em {new Date(insight.fetchedAt).toLocaleString("pt-AO")}.
        </p>
        <details>
          <summary>Registos de origem</summary>
          <ul>
            {insight.recordIDs.map((id) => (
              <li key={id}>
                <code>{id}</code>
              </li>
            ))}
          </ul>
        </details>
        <a href={insight.source} target="_blank" rel="noreferrer">
          {insight.family === "watchlistInformation"
            ? "Fonte original da publicação"
            : "Fonte do calendário de negociação"}
        </a>
        <p>
          <Link href={insight.destination}>
            Consultar os dados <Icon name="chevron-right" size={14} />
          </Link>
        </p>
        {optional ? <div className="insight-feedback">
          <span>Esta observação foi útil?</span>
          {(
            [
              ["fact", "Não foi útil"],
              ["familyOnSurface", "Mostrar menos deste tipo"],
              [null, "Repor preferência"],
            ] as const
          ).map(([scope, label]) => (
            <button
              className="text-button"
              key={label}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onFeedback(scope);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {label}
            </button>
          ))}
        </div> : <CookiePreferencesButton />}
      </details>
    </article>
  );
}
