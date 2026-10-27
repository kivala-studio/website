import { NewsLoading } from "./components/loading-placeholders";
import { Suspense } from "react";
import SiteHeader from "./components/site-header";
import SiteBrand from "./components/site-brand";
import Icon from "./components/invest-icon";
import Link from "./components/workspace-link";
import LandingAuth from "./components/landing-auth";
import AppMark from "./components/app-mark";
import DeviceFrame from "./device-frame";
import Image from "next/image";
import { CookiePreferencesButton } from "./components/cookie-consent";
import LandingMarket, { LandingMarketLoading } from "./landing-market";
import { RecentNews } from "./public-content";
import { planLimits } from "../lib/subscriptions";
import { appDistribution } from "../lib/app-distribution";
import PageMotion from "./page-motion";
import { SiteSchema } from "./site-schema";
import { pageMetadata, siteDescription, siteTitle } from "../lib/seo";
import "./homepage.css";

export const metadata = pageMetadata({ title: siteTitle, description: siteDescription, path: "/" });

const screenshots = "/screenshots/2026-10-20";

const features = [
  {
    title: "Cada instrumento, com o seu histórico.",
    points: [["chart", "Gráficos de um dia a todo o histórico"], ["markets", "Sessão do dia e desempenho por período"], ["watchlist", "Guarda os títulos que segues"]],
    link: ["/mercado", "Explorar o mercado"],
    screenshot: ["asset-detail", "Detalhe de uma acção na invest.ao: preço, gráfico de três meses e períodos"],
  },
  {
    title: "Compara no mesmo gráfico.",
    points: [["exchange", "Vários instrumentos lado a lado"], ["history", "O mesmo período para todos"], ["portfolio", "Regista compras e vê a tua carteira"]],
    link: ["/comparar", "Comparar instrumentos"],
    screenshot: ["asset-comparison", "Comparação de instrumentos na invest.ao"],
  },
  {
    title: "O mercado avisa-te.",
    points: [["alert", "Alertas de preço ou de variação"], ["trend-up", "Movimentos nos títulos guardados"], ["news", "Notícias dos emitentes que segues"]],
    link: ["/alertas", "Definir alertas"],
    screenshot: ["activity", "Actividade na invest.ao: movimentos dos instrumentos acompanhados"],
  },
];

const questions = [
  ["O que é a invest.ao?", "A invest.ao é uma plataforma para conhecer o mercado de capitais de Angola e acompanhar investimentos. Pesquisa instrumentos, consulta referências de preços e lê notícias no navegador. Com uma conta, organiza a carteira, guarda uma lista e cria alertas."],
  ["Posso comprar e vender títulos?", "Não. A invest.ao é uma ferramenta de informação e acompanhamento, não uma corretora. Não executa ordens de compra ou venda de títulos nem presta aconselhamento financeiro."],
  ["Os preços são em tempo real?", "Cada preço indica o tipo e a data da referência disponível. A actualização depende das fontes de mercado e não é uma garantia de cotação em tempo real. Confirma sempre a data apresentada em cada instrumento."],
  ["O que posso consultar sem conta?", "Podes pesquisar instrumentos e emitentes, consultar preços e históricos, ler notícias publicadas e comparar os planos. A carteira, a lista, os alertas e a comparação de instrumentos exigem conta e estão sujeitos aos limites do plano."],
];

export default function Home() {
  const distribution = appDistribution();
  return (
    <div className="landing-page">
      <SiteSchema />
      <PageMotion />
      <Suspense fallback={null}><LandingAuth /></Suspense>
      <a className="skip-link" href="#conteudo">Saltar para o conteúdo</a>
      <SiteHeader />
      <main id="conteudo">
        <section className="opening container" aria-labelledby="hero-title">
          <div className="opening-copy">
            <h1 id="hero-title">A bolsa de Angola, <span className="accent-text">fácil de acompanhar.</span></h1>
            <p className="opening-description">Cotações, históricos, alertas e a tua carteira. No iPhone e no navegador.</p>
            <div className="opening-actions">
              {distribution.url && <a className="solid-button" href={distribution.url} target="_blank" rel="noopener noreferrer"><Icon name="download" size={18} />{distribution.beta ? "Abrir no TestFlight" : "Descarregar na App Store"}</a>}
              <Link className="outline-button" href="/mercado">Ver o mercado <Icon name="arrow-right" size={17} /></Link>
            </div>
          </div>
          <figure className="opening-device">
            <DeviceFrame src={`${screenshots}/market-overview.png`} alt="Mercado na invest.ao para iPhone: instrumentos da BODIVA e variações" hero />
          </figure>
        </section>

        <section className="market-section container" id="precos" aria-labelledby="market-title">
          <div className="section-heading">
            <h2 id="market-title">Acções na BODIVA</h2>
            <Link className="quiet-link" href="/mercado">Ver todos os instrumentos <Icon name="arrow-right" size={16} /></Link>
          </div>
          <div className="landing-quotes">
            <Suspense fallback={<LandingMarketLoading />}><LandingMarket /></Suspense>
          </div>
        </section>

        <section className="feature-rows container" aria-label="O que podes fazer na invest.ao">
          {features.map((feature) => <article key={feature.title} className="feature-row" data-reveal>
            <div className="feature-copy">
              <h2>{feature.title}</h2>
              <ul>{feature.points.map(([icon, text]) => <li key={text}><Icon name={icon} size={18} />{text}</li>)}</ul>
              <Link className="quiet-link" href={feature.link[0]}>{feature.link[1]} <Icon name="arrow-right" size={16} /></Link>
            </div>
            <figure className="feature-device">
              <DeviceFrame src={`${screenshots}/${feature.screenshot[0]}.png`} alt={feature.screenshot[1]} />
            </figure>
          </article>)}
        </section>

        <section className="landing-news container" id="noticias" aria-labelledby="news-title">
          <div className="section-heading" data-reveal>
            <h2 id="news-title">Notícias do mercado</h2>
            <Link className="quiet-link" href="/noticias">Todas as notícias <Icon name="arrow-right" size={16} /></Link>
          </div>
          <Suspense fallback={<NewsLoading />}><RecentNews /></Suspense>
        </section>

        <section className="landing-plans container" id="planos" aria-labelledby="plans-title">
          <div className="plans-copy" data-reveal>
            <h2 id="plans-title">Grátis para começar.</h2>
            <p>O mercado, a pesquisa e as notícias são públicos. O Plus alarga a lista, os movimentos automáticos e as comparações.</p>
            <Link className="quiet-link" href="/planos">Ver planos <Icon name="arrow-right" size={16} /></Link>
          </div>
          <div className="landing-plan-options" data-reveal>
            <article><h3>Gratuito</h3><span className="plan-preview-limit">Até <strong>{planLimits.freeWatchlist}</strong> instrumentos na lista</span></article>
            <article className="landing-plus"><h3>invest.ao Plus</h3><span className="plan-preview-limit">Até <strong>{planLimits.plusWatchlist}</strong> instrumentos na lista</span></article>
          </div>
        </section>

        <section className="questions-section container" id="perguntas" aria-labelledby="questions-title">
          <div data-reveal><h2 id="questions-title">Perguntas frequentes</h2><a href="mailto:info@invest.ao" className="quiet-link">Fala connosco <Icon name="arrow-up-right" size={16} /></a></div>
          <div className="question-list" data-reveal>{questions.map(([question, answer]) => <details key={question}><summary>{question}<span className="faq-toggle" aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
        </section>

        {distribution.url && <section className="download-section container" aria-labelledby="download-title">
          <div className="download-panel" data-reveal>
            <AppMark size={56} />
            <h2 id="download-title">invest.ao para iPhone</h2>
            {distribution.qr && <Image className="download-qr" src={distribution.qr} width={148} height={148} alt="Código QR para descarregar a invest.ao" unoptimized />}
            <a className="solid-button" href={distribution.url} target="_blank" rel="noopener noreferrer"><Icon name="download" size={18} />{distribution.beta ? "Abrir no TestFlight" : "Descarregar na App Store"}</a>
          </div>
        </section>}
      </main>
      <footer className="site-footer container">
        <div className="footer-heading"><a href="#conteudo" aria-label="invest.ao — início"><SiteBrand /></a><a href="#conteudo" className="quiet-link">Voltar ao início <Icon name="arrow-up" size={16} /></a></div>
        <div className="footer-information"><span>© {new Date().getFullYear()} invest.ao</span><a href="/policy">Privacidade</a><a href="/planos">Planos</a>{distribution.url && <a href={distribution.url} target="_blank" rel="noopener noreferrer">{distribution.beta ? "iPhone · TestFlight" : "Aplicação para iPhone"}<Icon name="arrow-up-right" size={12} /></a>}<a href="/cookies">Cookies</a><CookiePreferencesButton /><a href="mailto:info@invest.ao">info@invest.ao</a></div>
        <p className="footer-disclaimer">A invest.ao fornece informação para acompanhar o mercado. Não presta aconselhamento financeiro nem executa operações de compra ou venda. A invest.ao é independente e não é afiliada à BODIVA.</p>
      </footer>
    </div>
  );
}
