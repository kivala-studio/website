export type LoadingVariant = "asset" | "market" | "news" | "article" | "plans" | "search" | "home";
function Ghost({ className = "" }: { className?: string }) {
  return <span className={`skeleton-block ${className}`} />;
}
function Lines() {
  return <div className="skeleton-lines"><Ghost /><Ghost /><Ghost className="skeleton-short" /></div>;
}
export function ChartLoading() {
  return (
    <div className="chart-loading" role="status" aria-label="A carregar o histórico" aria-busy="true">
      <span className="sr-only">A carregar o histórico…</span>
      <div className="skeleton-chart" aria-hidden="true"><Ghost className="skeleton-chart-label" /></div>
    </div>
  );
}
export function MarketLoading({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`public-loading ${compact ? "skeleton-market-compact" : ""}`} role="status" aria-label="A carregar o mercado" aria-busy="true">
      <span className="sr-only">A carregar o mercado…</span>
      <div aria-hidden="true">
        {!compact && <>
          <div className="skeleton-overview">{[0, 1, 2].map((i) => <div className="skeleton-panel" key={i}><Ghost className="skeleton-short" /><Ghost className="skeleton-medium" /></div>)}</div>
          <div className="skeleton-controls"><Ghost /><Ghost className="skeleton-medium" /></div>
        </>}
        <div className="skeleton-market-list">
          <div className="skeleton-market-labels"><Ghost className="skeleton-short" /><Ghost className="skeleton-short" /></div>
          {[0, 1, 2, 3, 4].map((i) => <div className="skeleton-market-row" key={i}>
            <Ghost className="skeleton-circle" /><div><Ghost className="skeleton-name" /><Ghost className="skeleton-symbol" /></div><div><Ghost className="skeleton-price" /><Ghost className="skeleton-reference" /></div>
          </div>)}
        </div>
      </div>
    </div>
  );
}
export function NewsLoading() {
  return (
    <div className="public-loading skeleton-news" role="status" aria-label="A carregar as notícias" aria-busy="true">
      <span className="sr-only">A carregar as notícias…</span>
      {[0, 1, 2].map((i) => <div className="skeleton-panel" aria-hidden="true" key={i}><Ghost className="skeleton-date" /><Lines /><Lines /></div>)}
    </div>
  );
}
export function PageLoading({ variant }: { variant: LoadingVariant }) {
  const asset = variant === "asset";
  return (
    <section className={`public-loading skeleton-page skeleton-page-${variant}`} role="status" aria-label="A carregar a página" aria-busy="true">
      <span className="sr-only">A carregar a página…</span>
      <div aria-hidden="true">
        <div className="skeleton-page-heading">
          {asset && <Ghost className="skeleton-back" />}
          <div className="skeleton-heading-row">{asset && <Ghost className="skeleton-circle" />}<div><Ghost className="skeleton-eyebrow" />{variant === "article" || variant === "plans" || variant === "home" ? <div className="skeleton-heading-lines"><Ghost /><Ghost className="skeleton-medium" />{variant === "article" && <Ghost className="skeleton-short" />}</div> : <Ghost className="skeleton-title" />}</div></div>
          <Ghost className="skeleton-description" />
        </div>
        {asset ? <>
          <div className="skeleton-panel skeleton-asset-overview"><div><Ghost className="skeleton-asset-price" /><Lines /></div><div><Lines /><Lines /></div></div>
          <div className="skeleton-actions">{[0, 1, 2].map((i) => <Ghost key={i} />)}</div>
          <div className="skeleton-panel"><Ghost className="skeleton-medium" /><ChartLoading /></div>
        </> : variant === "news" || variant === "home" ? <NewsLoading /> : variant === "article" ? <div className="skeleton-panel skeleton-article"><Lines /><Lines /><Lines /><Lines /></div> : variant === "plans" ? <div className="skeleton-plan-grid">{[0, 1].map((i) => <div className="skeleton-panel" key={i}><Ghost className="skeleton-eyebrow" /><Ghost className="skeleton-title" /><Lines /><Lines /><Ghost className="skeleton-plan-button" /></div>)}</div> : <MarketLoading />}
      </div>
    </section>
  );
}
