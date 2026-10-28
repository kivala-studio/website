import Link from "next/link";
import { PublicShell } from "../public-shell";
import { getMarket, read, type Article } from "../../lib/public-data";
import { reading } from "../../lib/market-presentation";
import MarketExplorer from "../market-explorer";
import { DataError, NewsList } from "../public-content";
export const metadata = {
  title: "Pesquisa | invest.ao",
  robots: { index: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q = "" } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const [market, news] = await Promise.all([
    getMarket(),
    query
      ? read<Article[]>("news_articles", {
          select:
            "id,slug,title,summary,published_at,news_article_securities(securities(id,symbol,name)),news_article_sources(source_url,source_title,news_sources(name))",
          status: "eq.published",
          published_at: `lte.${new Date().toISOString()}`,
          title: `ilike.*${query.replace(/[%*_]/g, "")}*`,
          order: "published_at.desc",
          limit: "30",
        }).catch(() => null)
      : Promise.resolve([]),
  ]);
  const rows =
    market.data?.securities
      .filter((s) =>
        normalize(
          `${s.symbol} ${s.name} ${s.isin} ${s.issuers?.name}`,
        ).includes(normalize(query)),
      )
      .map((security) => ({
        security,
        value: reading(security, market.data!),
      })) || [];
  return (
    <PublicShell>
      <header className="page-heading">
        <h1>Pesquisa.</h1>
      </header>
      <form action="/pesquisa" className="form-grid">
        <label>
          Instrumento, emitente ou notícia
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="O que procuras?"
            maxLength={100}
          />
        </label>
        <button
          className="primary-button"
          style={{ alignSelf: "end", justifySelf: "start" }}
        >
          Pesquisar
        </button>
      </form>
      {!query && (
        <section className="search-intro">
          <h2>Um nome, um símbolo ou uma notícia.</h2>
          <p>
            Pesquisa instrumentos e emitentes do mercado angolano ou encontra
            notícias publicadas. A consulta não exige conta.
          </p>
          <div className="search-suggestions">
            {market.data?.securities
              .filter(
                (s) =>
                  s.security_type === "equity" || s.security_type === "stock",
              )
              .slice(0, 4)
              .map((s) => (
                <Link key={s.id} prefetch={false} href={`/mercado/${s.id}`}>
                  {s.issuers?.short_name || s.symbol} →
                </Link>
              ))}
            <Link href="/mercado">Todo o mercado →</Link>
          </div>
        </section>
      )}
      {query && (
        <>
          <section className="public-section">
            <h2 className="search-result-heading">
              Instrumentos <small>({rows.length})</small>
            </h2>
            {market.error ? (
              <DataError content="os instrumentos" />
            ) : (
              <MarketExplorer rows={rows} searchResults />
            )}
          </section>
          <section className="public-section">
            <h2 className="search-result-heading">Notícias</h2>
            {news === null ? (
              <DataError content="as notícias" />
            ) : news.length ? (
              <NewsList articles={news} />
            ) : (
              <div className="data-state" role="status">
                <h3>Nenhuma notícia encontrada.</h3>
                <p>Tenta outro nome ou termo de pesquisa.</p>
              </div>
            )}
          </section>
        </>
      )}
    </PublicShell>
  );
}
