import Link from "next/link";
import { PublicShell } from "../public-shell";
import { getMarket, getNews, read } from "../../lib/public-data";
import { reading, date, kind } from "../../lib/market-presentation";
import MarketExplorer from "../market-explorer";
import { DataError, NewsList } from "../public-content";
import MarketSpotlight from "../components/market-spotlight";
import MarketPulse, { type PulseRow } from "../components/market-pulse";
import InsightSection from "../components/insight-section";
import HomeAccount from "../components/home-account";
import Icon from "../components/invest-icon";
import { pageMetadata } from "../../lib/seo";
import { DevelopmentOverview } from "../components/development-state";
import { appleWebDeletionAvailable } from "../../lib/web-feature-config";

export const metadata = {
  ...pageMetadata({
  title: "Dashboard | invest.ao",
  description:
    "Acompanha o mercado angolano, as notícias e os teus investimentos num só lugar.",
  path: "/dashboard",
  }),
  robots: { index: false },
};
export default async function Dashboard() {
  const [market, news, pulse] = await Promise.all([
    getMarket(),
    getNews(),
    read<PulseRow[]>("quality_market_pulse_history", {
      select: "trading_date,value,daily_change_percent,data_quality",
      order: "trading_date.desc",
      limit: "30",
    }).catch(() => null),
  ]);
  const rows =
    market.data?.securities.map((security) => ({
      security,
      value: reading(security, market.data!),
    })) || [];
  const equities = rows.filter((row) => kind(row.security) === "Acções");
  const overview = market.data?.quotes.overview[0];
  const status: Record<string, string> = {
    open: "Sessão aberta",
    closed: "Sessão encerrada",
    opening_soon: "Abertura em breve",
  };
  return (
    <PublicShell>
      <header className="page-heading heading-line">
        <div>
          <p className="eyebrow">INVESTIR COMEÇA POR ENTENDER.</p>
          <h1>
            O teu lugar no
            <br />
            <span>mercado angolano.</span>
          </h1>
          <p>
            Os números, as notícias e os teus investimentos. Tudo na tua
            invest.ao.
          </p>
        </div>
        <span className="date-chip">
          {date(new Date().toISOString())} · Luanda
        </span>
      </header>
      <div className="market-session-line">
        <span>
          <i className="session-dot" />
          {status[overview?.status || ""] || "Estado indisponível"}
        </span>
        <span>{rows.length} instrumentos</span>
        <span>
          Referência:{" "}
          {overview?.last_updated_at
            ? date(overview.last_updated_at)
            : "indisponível"}
        </span>
      </div>
      <div className="home-lead">
        {market.data ? (
          <MarketSpotlight market={market.data} />
        ) : (
          <DataError content="o mercado" />
        )}
        <HomeAccount />
      </div>
      <InsightSection surface="home" />
      <section className="home-market-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">EXPLORAR</p>
            <h2>Conhece as empresas.</h2>
          </div>
          <Link href="/mercado">Ver todos os instrumentos</Link>
        </div>
        {market.error ? (
          <DataError content="o mercado" />
        ) : (
          <MarketExplorer
            rows={(equities.length ? equities : rows).slice(0, 7)}
          />
        )}
      </section>
      <MarketPulse rows={pulse} />
      <div className="home-discovery">
        <Link href="/resumos">
          <Icon name="history" size={28} />
          <div>
            <span>A SEMANA EM PERSPECTIVA</span>
            <h2>O que mudou no mercado?</h2>
            <p>Revisita os movimentos e os fechos verificados.</p>
          </div>
          <Icon name="chevron-right" />
        </Link>
        <Link href="/simular">
          <Icon name="calculator" size={28} />
          <div>
            <span>EXPLORA UMA HIPÓTESE</span>
            <h2>E se começasses hoje?</h2>
            <p>Simula o efeito do tempo e dos teus reforços.</p>
          </div>
          <Icon name="chevron-right" />
        </Link>
      </div>
      <section className="public-section">
        <div className="section-title">
          <h2>Para ler com contexto</h2>
          <Link href="/noticias">Todas as notícias</Link>
        </div>
        {news.error ? (
          <DataError content="as notícias" />
        ) : (
          <NewsList articles={news.data.slice(0, 3)} />
        )}
      </section>
      <DevelopmentOverview appleDeletionAvailable={appleWebDeletionAvailable()} />
    </PublicShell>
  );
}
