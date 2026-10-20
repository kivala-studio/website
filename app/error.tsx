"use client";
import { PublicShell } from "./public-shell";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <PublicShell>
      <section className="empty-state" role="alert">
        <h1>Não foi possível abrir esta página.</h1>
        <p>A ligação pode estar temporariamente indisponível.</p>
        <button className="primary-button" onClick={reset}>
          Tentar novamente
        </button>
      </section>
    </PublicShell>
  );
}
