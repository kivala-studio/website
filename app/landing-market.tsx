import { MarketLoading } from "./components/loading-placeholders";
import Link from "./components/workspace-link";
import { getMarket } from "../lib/public-data";
import { kind, reading } from "../lib/market-presentation";
import MarketReading from "./market-reading";
import Icon from "./components/invest-icon";

export function LandingMarketLoading() {
  return <MarketLoading compact />;
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
        <span className="market-tab"><Icon name="markets" size={18} /> Acções</span>
        <p className="market-status"><span aria-hidden="true" />{status[market.quotes.overview[0]?.status] || "Estado indisponível"}</p>
      </div>
      <div className="landing-quotes-list">
        <div className="landing-market-labels" aria-hidden="true">
          <span>Instrumento</span>
          <div><span>Preço / referência</span><span>Variação</span></div>
          <span />
        </div>
        {equities.slice(0, 5).map((security) => (
          <Link key={security.id} href={`/mercado/${security.id}`} prefetch={false} className="landing-quote">
            <div className="landing-quote-name">
              <span className="issuer-mark" aria-hidden="true">{security.symbol.slice(0, 3)}</span>
              <div><strong>{security.issuers?.short_name || security.symbol}</strong>
              <small>{security.symbol}</small></div>
            </div>
            <MarketReading security={security} value={reading(security, market)} />
            <Icon name="arrow-up-right" size={16} />
          </Link>
        ))}
        {!equities.length && <p className="landing-quotes-empty">Sem acções disponíveis nesta consulta.</p>}
      </div>
      <p className="landing-quotes-footer">Preços por acção em Kz. Confirma a data de cada referência.</p>
    </>
  );
}
