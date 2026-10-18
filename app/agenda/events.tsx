"use client";
import { useState } from "react";
import { date } from "../../lib/market-presentation";
import { interestWeight } from "../../lib/personalisation";
import { usePersonalisation } from "../components/personalisation-provider";
import { useAccount } from "../components/account-provider";
export type CalendarEvent = {
  id: string;
  day: string;
  title: string;
  issuer: string;
  source: string;
  assets: string[];
};
export default function Events({ events }: { events: CalendarEvent[] }) {
  const { user, privateMode } = useAccount();
  const { profile, ready, error } = usePersonalisation();
  const [personal, setPersonal] = useState(false);
  const personalized = personal && !!user && !privateMode;
  const shown = personalized
    ? events
        .filter((e) => interestWeight(profile, e.assets) > 0)
        .sort(
          (a, b) =>
            interestWeight(profile, b.assets) -
              interestWeight(profile, a.assets) ||
            a.day.localeCompare(b.day) ||
            a.id.localeCompare(b.id),
        )
    : events;
  return (
    <>
      {user && !privateMode && (
        <div className="filter-tabs">
          <button aria-pressed={!personal} onClick={() => setPersonal(false)}>
            Todos os eventos
          </button>
          <button aria-pressed={personal} onClick={() => setPersonal(true)}>
            Para ti
          </button>
        </div>
      )}
      {personalized && (
        <p className="fine-print">
          Primeiro, emitentes da tua carteira, lista e alertas; depois,
          instrumentos que tens consultado.
        </p>
      )}
      {personalized && !ready ? (
        <p role="status">
          {error
            ? "Os interesses estão indisponíveis. Consulta todos os eventos."
            : "A carregar os teus interesses…"}
        </p>
      ) : (
        shown.map((e) => (
          <article className="calendar-row" key={e.id}>
            <div className="calendar-date">
              {e.day.slice(-2)}
              <small>
                {new Intl.DateTimeFormat("pt-AO", { month: "short" }).format(
                  new Date(`${e.day}T12:00:00Z`),
                )}
              </small>
            </div>
            <div>
              <h3>{e.issuer}</h3>
              <p>
                {e.title} · {date(e.day)}
              </p>
              {personalized && (
                <small>
                  {profile.held.some((id) => e.assets.includes(id))
                    ? "Na tua carteira"
                    : profile.watched.some((id) => e.assets.includes(id))
                      ? "Na tua lista"
                      : profile.alerts.some((id) => e.assets.includes(id))
                        ? "Tem um alerta teu"
                        : "Dos instrumentos que consultas"}
                </small>
              )}
              {/^https:\/\//.test(e.source) && (
                <p>
                  <a
                    className="text-button"
                    href={e.source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Fonte do anúncio
                  </a>
                </p>
              )}
            </div>
          </article>
        ))
      )}
      {!shown.length && (!personalized || ready) && (
        <p className="empty-state">
          {personalized
            ? "Não há eventos dos teus instrumentos anunciados neste período. Todos os eventos continuam disponíveis no separador ao lado."
            : "Não há eventos anunciados neste período na fonte disponível."}
        </p>
      )}
    </>
  );
}
