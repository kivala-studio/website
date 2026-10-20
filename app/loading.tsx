export default function Loading() {
  return (
    <div className="container">
      <section
        className="route-loading"
        role="status"
        aria-label="A abrir a página"
      >
        <p className="eyebrow">A ABRIR…</p>
        <div aria-hidden="true" className="loading-title" />
        <div aria-hidden="true" className="loading-content" />
      </section>
    </div>
  );
}
