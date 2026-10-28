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
          <h1>
            O teu lugar no
            <br />
            <span>mercado angolano.</span>
          </h1>
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
            <h2>Conhece as empresas.</h2>
          </div>
          <Link className="text-link" href="/mercado">Ver todos <Icon name="arrow-right" size={16} /></Link>
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
            <h2>O que mudou no mercado?</h2>
          </div>
          <Icon name="chevron-right" />
        </Link>
        <Link href="/simular">
          <Icon name="calculator" size={28} />
          <div>
            <h2>E se começasses hoje?</h2>
          </div>
          <Icon name="chevron-right" />
        </Link>
      </div>
      <section className="public-section">
        <div className="section-title">
          <h2>Notícias</h2>
          <Link className="text-link" href="/noticias">Todas <Icon name="arrow-right" size={16} /></Link>
        </div>
        {news.error ? (
          <DataError content="as notícias" />
        ) : (
          <NewsList articles={news.data.slice(0, 3)} />
        )}
      </section>
    </PublicShell>
  );
}
