import { MarketLoading } from "./components/loading-placeholders";
import Link from "next/link";
import { date, kind, reading } from "../lib/market-presentation";
import { getMarket, getNews, type Article } from "../lib/public-data";
import MarketExplorer from "./market-explorer";
export function DataError({ content }: { content: string }) {
  return (
    <div className="data-state" role="status">
      <h3>Não foi possível carregar {content}.</h3>
      <p>
        Tenta novamente. A consulta pública continua disponível quando a ligação
        recuperar.
      </p>
      <a className="quiet-button" href="">
        Tentar novamente
      </a>
    </div>
  );
}
export async function MarketContent({
  preview = false,
}: {
  preview?: boolean;
}) {
  const result = await getMarket();
  if (result.error) return <DataError content="o mercado" />;
  const m = result.data;
  const overview = m.quotes.overview[0];
  const status: Record<string, string> = {
    open: "Mercado aberto",
    closed: "Mercado encerrado",
    opening_soon: "Antes da abertura",
  };
  const sorted = [...m.securities].sort(
    (a, b) =>
      Number(kind(b) === "Acções") - Number(kind(a) === "Acções") ||
      a.symbol.localeCompare(b.symbol),
  );
  const rows = (preview ? sorted.slice(0, 5) : sorted).map((security) => ({
    security,
    value: reading(security, m),
  }));
  return (
    <>
      <div className="market-meta">
        <span>
          <small>Estado do mercado</small>
          <strong>{status[overview?.status] ?? "Indisponível"}</strong>
        </span>
        <span><small>Fonte</small><strong>{overview?.source || "BODIVA"}</strong></span>
        <span>
          <small>Última publicação · Luanda</small>
          <strong>{date(overview?.last_updated_at, true)}</strong>
        </span>
      </div>
      {overview?.data_status !== "current" &&
      overview?.data_status !== "fresh" ? (
        <p className="data-note">
          Consulta datada. Confirma a data e o tipo de preço de cada
          instrumento; os dados não representam uma cotação em tempo real.
        </p>
      ) : null}
      <MarketExplorer rows={rows} search={!preview} />
      {m.closesUnavailable ? (
        <p className="data-note">
          Os fechos verificados não estão disponíveis nesta consulta.
        </p>
      ) : null}
      <p className="data-note">
        Acções: preço por unidade. Obrigações: cotação percentual, que não
        representa o cupão nem a rendibilidade. Uma variação indisponível não
        significa 0%.
      </p>
      {preview ? (
        <Link className="text-link" href="/mercado">
          Consultar todo o mercado
        </Link>
      ) : (
        <form action="/mercado">
          <button className="quiet-button" type="submit">
            Actualizar consulta ↻
          </button>
        </form>
      )}
    </>
  );
}
export function NewsList({
  articles,
  featured = false,
}: {
  articles: Article[];
  featured?: boolean;
}) {
  if (!articles.length)
    return (
      <div className="data-state">
        <h3>Ainda sem notícias publicadas.</h3>
      </div>
    );
  // The featured list opens with the latest story as a lead card, as on the homepage.
  return (
    <div className={featured ? "news-list featured" : "news-list"}>
      {articles.map((a) => (
        <article key={a.id}>
          <time dateTime={a.published_at}>{date(a.published_at)}</time>
          <h3>
            <Link
              prefetch={false}
              href={`/noticias/${encodeURIComponent(a.slug)}`}
            >
              {a.title}
            </Link>
          </h3>
          <p>{a.summary}</p>
        </article>
      ))}
    </div>
  );
}
export async function RecentNews() {
  const result = await getNews();
  return result.error ? (
    <DataError content="as notícias" />
  ) : (
    <NewsList articles={result.data.slice(0, 3)} />
  );
}
export function LoadingContent() {
  return <MarketLoading />;
}
