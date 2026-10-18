import { PublicShell } from "./public-shell";
export default function Loading() {
  return (
    <PublicShell>
      <section
        className="route-loading"
        role="status"
        aria-label="A abrir a página"
      >
        <p className="eyebrow">A ABRIR…</p>
        <div aria-hidden="true" className="loading-title" />
        <div aria-hidden="true" className="loading-content" />
      </section>
    </PublicShell>
  );
}
