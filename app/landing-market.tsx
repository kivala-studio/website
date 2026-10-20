import Link from "./components/workspace-link";
import { getMarket } from "../lib/public-data";
import { kind, reading } from "../lib/market-presentation";
import MarketReading from "./market-reading";

export function LandingMarketLoading() {
  return (
    <div className="landing-quotes-state" role="status">
      <p className="eyebrow">BODIVA · ACÇÕES</p>
      <h2>O mercado, à vista.</h2>
      <p>A consultar os preços de referência…</p>
    </div>
  );
}

export default async function LandingMarket() {
  const result = await getMarket();
  if (result.error) {
    return (
      <div className="landing-quotes-state" role="status">
        <p className="eyebrow">BODIVA · ACÇÕES</p>
        <h2>O mercado, à vista.</h2>
        <p>Não foi possível consultar os preços neste momento.</p>
        <Link className="quiet-link" href="/mercado">Voltar a consultar</Link>
      </div>
    );
  }
  const market = result.data;
  const equities = market.securities
    .filter((security) => kind(security) === "Acções")
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  const status: Record<string, string> = {
    open: "Mercado aberto",
    closed: "Mercado encerrado",
    opening_soon: "Antes da abertura",
  };
  return (
    <>
      <div className="landing-quotes-heading">
        <p className="eyebrow">BODIVA · ACÇÕES</p>
        <h2>O mercado, à vista.</h2>
        <p>{status[market.quotes.overview[0]?.status] || "Estado indisponível"}</p>
      </div>
      <div className="landing-quotes-list">
        {equities.slice(0, 5).map((security) => (
          <Link key={security.id} href={`/mercado/${security.id}`} prefetch={false} className="landing-quote">
            <div className="landing-quote-name">
              <strong>{security.issuers?.short_name || security.symbol}</strong>
              <span>{security.symbol}</span>
            </div>
            <MarketReading security={security} value={reading(security, market)} />
          </Link>
        ))}
        {!equities.length && <p className="landing-quotes-empty">Sem acções disponíveis nesta consulta.</p>}
      </div>
      <div className="landing-quotes-footer">
        <p>Preços por acção em Kz. Confirma a data de cada referência; os valores podem estar desactualizados.</p>
        <Link className="quiet-link" href="/mercado">Explorar o mercado</Link>
      </div>
    </>
  );
}
