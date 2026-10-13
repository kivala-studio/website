import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell, AppInvitation } from "../../public-shell";
import { DataError, NewsList } from "../../public-content";
import { Consultation } from "../../app-prompt";
import MarketReading from "../../market-reading";
import { getMarket, getIssuer, getNews } from "../../../lib/public-data";
import { kind, reading } from "../../../lib/market-presentation";
import { pageMetadata } from "../../../lib/seo";
type Props = { params: Promise<{ id: string }> };
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const result = uuid.test(id) ? await getMarket() : null;
  const s = result?.data?.securities.find((s) => s.id === id);
  return pageMetadata({
    title: s
      ? `${s.symbol} — ${s.name || s.symbol} | invest.ao`
      : "Instrumento | invest.ao",
    description: s
      ? `Consulta a cotação disponível de ${s.name || s.symbol}, com data e contexto da referência BODIVA.`
      : "Consulta pública de instrumentos.",
    path: `/mercado/${id}`,
  });
}
export default async function InstrumentPage({ params }: Props) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const result = await getMarket();
  if (result.error)
    return (
      <PublicShell>
        <DataError content="o instrumento" />
      </PublicShell>
    );
  const s = result.data.securities.find((s) => s.id === id);
  if (!s) notFound();
  const [issuer, news] = await Promise.all([
    s.issuer_id ? getIssuer(s.issuer_id) : null,
    getNews(0, s.id),
  ]);
  const type = kind(s);
  return (
    <PublicShell>
      <Consultation content="instrument" />
      <Link className="back-link" href="/mercado">
        ← Mercado
      </Link>
      <header className="page-heading">
        <p className="eyebrow">{type}</p>
        <h1>{s.symbol}</h1>
        <p>{issuer?.data?.name || s.name || s.symbol}</p>
      </header>
      <section className="instrument-overview">
        <MarketReading large security={s} value={reading(s, result.data)} />
        <dl className="instrument-facts">
          <div>
            <dt>Emitente</dt>
            <dd>{issuer?.data?.name || "Não disponível"}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{type}</dd>
          </div>
          <div>
            <dt>Moeda</dt>
            <dd>{s.currency}</dd>
          </div>
          {s.isin ? (
            <div>
              <dt>ISIN</dt>
              <dd>{s.isin}</dd>
            </div>
          ) : null}
          <div>
            <dt>Mercado</dt>
            <dd>BODIVA</dd>
          </div>
        </dl>
      </section>
      {type.startsWith("Obrigações") ? (
        <p className="data-note">
          Cotação percentual. Não representa o cupão nem a rendibilidade. Valor
          nominal e condições contratuais precisam de confirmação na fonte.
          Ausência de cotação não indica vencimento ou reembolso.
        </p>
      ) : null}
      <AppInvitation feature="watchlist" position="instrument-price" compact />
      {issuer?.data?.description ? (
        <section className="public-section prose">
          <h2>Sobre o emitente.</h2>
          <p>{issuer.data.description}</p>
        </section>
      ) : null}
      <section className="public-section">
        <div className="section-title">
          <h2>Notícias relacionadas.</h2>
        </div>
        {news.error ? (
          <DataError content="as notícias relacionadas" />
        ) : (
          <NewsList articles={news.data.slice(0, 3)} />
        )}
      </section>
    </PublicShell>
  );
}
