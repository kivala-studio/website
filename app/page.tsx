import { Suspense } from "react";
import Image from "next/image";
import SiteHeader from "./components/site-header";
import SiteBrand from "./components/site-brand";
import Icon from "./components/invest-icon";
import Link from "./components/workspace-link";
import LandingAuth from "./components/landing-auth";
import AppMark from "./components/app-mark";
import DeviceFrame from "./device-frame";
import { CookiePreferencesButton } from "./components/cookie-consent";
import { MarketMovers, MarketMoversLoading, MarketTicker, PulseCard } from "./landing-market";
import { getNews } from "../lib/public-data";
import { date } from "../lib/market-presentation";
import { planLimits } from "../lib/subscriptions";
import { appDistribution } from "../lib/app-distribution";
import PageMotion from "./page-motion";
import { SiteSchema } from "./site-schema";
import { pageMetadata, siteDescription, siteTitle } from "../lib/seo";
import "./homepage.css";

export const metadata = pageMetadata({ title: siteTitle, description: siteDescription, path: "/" });

const screenshots = "/screenshots/2026-10-20";

const plans = [
  {
    name: "Gratuito",
    items: [`${planLimits.freeWatchlist} instrumentos guardados`, `Movimentos automáticos para ${planLimits.freeMovement}`, `1 comparação de ${planLimits.freeComparison} por semana`],
  },
  {
    name: "invest.ao Plus",
    items: [`Até ${planLimits.plusWatchlist} instrumentos guardados`, "Movimentos automáticos em todos", `Compara até ${planLimits.plusComparison}, sem limite semanal`],
  },
];

const questions = [
  ["O que é a invest.ao?", "A invest.ao é uma plataforma para conhecer o mercado de capitais de Angola e acompanhar investimentos. Pesquisa instrumentos, consulta referências de preços e lê notícias no navegador. Com uma conta, organiza a carteira, guarda uma lista e cria alertas."],
  ["Posso comprar e vender títulos?", "Não. A invest.ao é uma ferramenta de informação e acompanhamento, não uma corretora. Não executa ordens de compra ou venda de títulos nem presta aconselhamento financeiro."],
  ["Os preços são em tempo real?", "Cada preço indica o tipo e a data da referência disponível. A actualização depende das fontes de mercado e não é uma garantia de cotação em tempo real. Confirma sempre a data apresentada em cada instrumento."],
  ["O que posso consultar sem conta?", "Podes pesquisar instrumentos e emitentes, consultar preços e históricos, ler notícias publicadas e comparar os planos. A carteira, a lista, os alertas e a comparação de instrumentos exigem conta e estão sujeitos aos limites do plano."],
];

async function LatestNews() {
  const result = await getNews();
  if (result.error || !result.data.length) return <p className="market-state">Sem notícias publicadas neste momento.</p>;
  const [lead, ...rest] = result.data;
  return (
    <div className="news-layout">
      <Link href={`/noticias/${encodeURIComponent(lead.slug)}`} prefetch={false} className="news-lead">
        <time dateTime={lead.published_at}>{date(lead.published_at)}</time>
        <h3>{lead.title}</h3>
        <p>{lead.summary}</p>
      </Link>
      <ul className="news-rest">
        {rest.slice(0, 4).map((article) => (
          <li key={article.id}>
            <Link href={`/noticias/${encodeURIComponent(article.slug)}`} prefetch={false}>
              <time dateTime={article.published_at}>{date(article.published_at)}</time>
              <strong>{article.title}</strong>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  const distribution = appDistribution();
  const storeLabel = distribution.beta ? "Abrir no TestFlight" : "Descarregar na App Store";
  return (
    <div className="landing-page">
      <SiteSchema />
      <PageMotion />
      <Suspense fallback={null}><LandingAuth /></Suspense>
      <a className="skip-link" href="#conteudo">Saltar para o conteúdo</a>
      <SiteHeader />
      <main id="conteudo">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">A bolsa de Angola, <span>fácil de acompanhar.</span></h1>
            <p>Cotações, históricos, alertas e a tua carteira. No iPhone e no navegador.</p>
            <div className="hero-actions">
              {distribution.url && <a className="button-primary" href={distribution.url} target="_blank" rel="noopener noreferrer"><Icon name="download" size={18} />{storeLabel}</a>}
              <Link className="button-secondary" href="/mercado">Ver o mercado <Icon name="arrow-right" size={17} /></Link>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-glow" aria-hidden="true" />
            <DeviceFrame src={`${screenshots}/market-overview.png`} lightSrc={`${screenshots}/market-overview-light.png`} alt="Mercado na invest.ao para iPhone" hero />
            <Suspense fallback={null}><PulseCard /></Suspense>
          </div>
        </section>

        <Suspense fallback={<div className="ticker ticker-loading" />}><MarketTicker /></Suspense>

        <section className="section container" id="precos" aria-labelledby="market-title">
          <header className="section-head">
            <h2 id="market-title">Hoje na BODIVA</h2>
            <Link className="text-link" href="/mercado">Ver todos <Icon name="arrow-right" size={16} /></Link>
          </header>
          <Suspense fallback={<MarketMoversLoading />}><MarketMovers /></Suspense>
          <p className="section-note">Preços em Kz, com a data de cada referência. Independente da BODIVA. Não é aconselhamento financeiro.</p>
        </section>

        <section className="section container" aria-labelledby="features-title">
          <header className="section-head">
            <h2 id="features-title">Tudo o que segues, num só lugar.</h2>
          </header>
          <div className="bento">
            <Link href="/mercado" className="tile tile-detail" data-reveal>
              <div className="tile-copy"><Icon name="chart" size={22} /><h3>Histórico de cada título</h3><p>Gráficos por período, sessão do dia e desempenho.</p></div>
              <div className="tile-phone"><DeviceFrame src={`${screenshots}/asset-detail.png`} lightSrc={`${screenshots}/asset-detail-light.png`} alt="Detalhe de uma acção na invest.ao" /></div>
            </Link>
            <Link href="/comparar" className="tile tile-compare" data-reveal>
              <div className="tile-copy"><Icon name="exchange" size={22} /><h3>Compara no mesmo gráfico</h3></div>
              <div className="compare-lines" aria-hidden="true">
                <svg viewBox="0 0 240 90" preserveAspectRatio="none">
                  <path className="line-1" d="M0 70 L30 62 L60 66 L90 48 L120 52 L150 34 L180 40 L210 22 L240 18" />
                  <path className="line-2" d="M0 60 L30 64 L60 56 L90 60 L120 50 L150 54 L180 46 L210 50 L240 44" />
                  <path className="line-3" d="M0 40 L30 46 L60 52 L90 50 L120 60 L150 58 L180 66 L210 62 L240 70" />
                </svg>
              </div>
            </Link>
            <Link href="/alertas" className="tile tile-alert" data-reveal>
              <div className="tile-copy"><Icon name="alert" size={22} /><h3>Alertas de preço e variação</h3></div>
              <div className="notification" aria-hidden="true">
                <AppMark size={28} />
                <span><strong>invest.ao</strong><small>O preço que definiste foi atingido.</small></span>
              </div>
            </Link>
            <Link href="/carteira" className="tile tile-portfolio" data-reveal>
              <div className="tile-copy"><Icon name="portfolio" size={22} /><h3>A tua carteira</h3><p>Regista compras e vê o ganho ou a perda.</p></div>
              <div className="privacy-value" aria-hidden="true"><span>••••••• Kz</span><Icon name="eye-off" size={20} /></div>
            </Link>
            <Link href="/resumos" className="tile tile-recap" data-reveal>
              <div className="tile-copy"><Icon name="history" size={22} /><h3>Resumo semanal</h3><p>A semana do mercado em histórias.</p></div>
              <div className="story-bars" aria-hidden="true"><span /><span /><span /><span /></div>
            </Link>
          </div>
        </section>

        <section className="section container" id="noticias" aria-labelledby="news-title">
          <header className="section-head">
            <h2 id="news-title">Notícias</h2>
            <Link className="text-link" href="/noticias">Todas <Icon name="arrow-right" size={16} /></Link>
          </header>
          <Suspense fallback={<div className="news-layout skeleton-card" aria-busy="true" />}><LatestNews /></Suspense>
        </section>

        <section className="section container" id="planos" aria-labelledby="plans-title">
          <header className="section-head">
            <h2 id="plans-title">Grátis para começar.</h2>
            <Link className="text-link" href="/planos">Ver planos <Icon name="arrow-right" size={16} /></Link>
          </header>
          <div className="plans">
            {plans.map((plan, index) => (
              <article key={plan.name} className={index ? "plan plan-plus" : "plan"} data-reveal>
                <h3>{plan.name}</h3>
                <ul>{plan.items.map((item) => <li key={item}><Icon name="check" size={18} />{item}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="section container faq" id="perguntas" aria-labelledby="questions-title">
          <h2 id="questions-title">Perguntas frequentes</h2>
          <div className="question-list">
            {questions.map(([question, answer]) => <details key={question}><summary>{question}<Icon name="chevron-down" size={18} /></summary><p>{answer}</p></details>)}
          </div>
        </section>

        {distribution.url && <section className="container download" aria-labelledby="download-title">
          <div className="download-panel" data-reveal>
            <div className="download-copy">
              <AppMark size={64} />
              <h2 id="download-title">invest.ao para iPhone</h2>
              <a className="button-primary" href={distribution.url} target="_blank" rel="noopener noreferrer"><Icon name="download" size={18} />{storeLabel}</a>
            </div>
            {distribution.qr && <Image className="download-qr" src={distribution.qr} width={168} height={168} alt="Código QR para descarregar a invest.ao" unoptimized />}
          </div>
        </section>}
      </main>
      <footer className="site-footer container">
        <div className="footer-top">
          <a href="#conteudo" aria-label="invest.ao — início"><SiteBrand /></a>
          <nav aria-label="Rodapé">
            <Link href="/mercado">Mercado</Link><Link href="/noticias">Notícias</Link><Link href="/planos">Planos</Link><a href="/policy">Privacidade</a><a href="/cookies">Cookies</a><CookiePreferencesButton /><a href="mailto:info@invest.ao">info@invest.ao</a>
          </nav>
        </div>
        <p className="footer-disclaimer">© {new Date().getFullYear()} invest.ao · Informação para acompanhar o mercado. Não presta aconselhamento financeiro nem executa operações de compra ou venda. Independente e não afiliada à BODIVA.</p>
      </footer>
    </div>
  );
}
