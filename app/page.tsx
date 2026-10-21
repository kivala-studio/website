import { Suspense } from "react";
import SiteHeader from "./components/site-header";
import SiteBrand from "./components/site-brand";
import Icon from "./components/invest-icon";
import Link from "./components/workspace-link";
import LandingAuth from "./components/landing-auth";
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

const shortcuts = [
  { icon: "markets", title: "Mercado", description: "Instrumentos e preços", href: "/mercado" },
  { icon: "news", title: "Notícias", description: "O contexto do mercado", href: "/noticias" },
  { icon: "portfolio", title: "Carteira", description: "Os teus investimentos", href: "/carteira" },
  { icon: "watchlist", title: "A tua lista", description: "Os títulos que segues", href: "/lista" },
];

const accountTools = [
  { icon: "portfolio", title: "Organiza a carteira", description: "Regista posições e acompanha a composição dos teus investimentos.", href: "/carteira" },
  { icon: "watchlist", title: "Guarda a tua lista", description: "Reúne os instrumentos que queres acompanhar mais de perto.", href: "/lista" },
  { icon: "alert", title: "Define os teus alertas", description: "Escolhe os preços e as variações que merecem a tua atenção.", href: "/alertas" },
  { icon: "exchange", title: "Compara instrumentos", description: "Consulta a evolução de dois títulos no mesmo período, lado a lado.", href: "/comparar" },
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
          <p className="hero-eyebrow"><span aria-hidden="true" /> MERCADO DE CAPITAIS DE ANGOLA</p>
          <h1 id="hero-title">Conhece o mercado.<br /><span className="accent-text">Acompanha o que importa.</span></h1>
          <p className="opening-description">Preços, instrumentos e notícias. A tua carteira, lista e alertas.<br className="desktop-break" /> Um lugar para acompanhar os teus investimentos.</p>
          <form className="landing-search" action="/pesquisa" role="search" aria-label="Pesquisar no mercado">
            <label className="landing-search-label" htmlFor="landing-query">Nome, símbolo ou notícia</label>
            <Icon name="search" size={21} />
            <input id="landing-query" name="q" type="search" maxLength={100} placeholder="Nome, símbolo ou notícia" />
            <button type="submit">Pesquisar <Icon name="arrow-right" size={17} /></button>
          </form>
          <nav className="product-shortcuts" aria-label="Explorar a invest.ao">
            {shortcuts.map((item) => <Link key={item.href} href={item.href} className="product-shortcut">
              <span className="shortcut-icon"><Icon name={item.icon} size={22} /></span>
              <span><strong>{item.title}</strong><small>{item.description}</small></span>
              <Icon name="chevron-right" size={16} />
            </Link>)}
          </nav>
        </section>

        <section className="market-section container" id="precos" aria-labelledby="market-title">
          <div className="section-heading">
            <div><p className="eyebrow">COMEÇA PELO MERCADO</p><h2 id="market-title">Angola, em perspectiva.</h2></div>
          </div>
          <div className="landing-quotes">
            <Suspense fallback={<LandingMarketLoading />}><LandingMarket /></Suspense>
          </div>
        </section>

        <section className="landing-news container" id="noticias" aria-labelledby="news-title">
          <div className="section-heading" data-reveal>
            <div><p className="eyebrow">PARA LÁ DOS PREÇOS</p><h2 id="news-title">O que se passa no mercado.</h2></div>
            <Link className="quiet-link" href="/noticias">Todas as notícias <Icon name="arrow-right" size={16} /></Link>
          </div>
          <Suspense fallback={<p className="landing-news-state" role="status">A consultar as notícias publicadas…</p>}><RecentNews /></Suspense>
        </section>

        <section className="account-section container" id="aplicacao" aria-labelledby="account-title">
          <div className="account-panel" data-reveal>
            <div className="account-copy">
              <p className="eyebrow">O TEU ESPAÇO NA INVEST.AO</p>
              <h2 id="account-title">Do mercado<br /><span className="accent-text">à tua carteira.</span></h2>
              <p>Passa da consulta ao acompanhamento. Entra na tua conta para organizar os teus investimentos e voltar ao que te interessa.</p>
              <Link className="solid-button" href="/dashboard">Abrir a minha área <Icon name="arrow-right" size={18} /></Link>
            </div>
            <nav className="account-tools" aria-label="Ferramentas da tua conta">
              {accountTools.map((tool) => <Link key={tool.href} href={tool.href} className="account-tool">
                <span className="account-tool-icon"><Icon name={tool.icon} size={23} /></span>
                <span><strong>{tool.title}</strong><small>{tool.description}</small></span>
                <Icon name="arrow-up-right" size={17} />
              </Link>)}
            </nav>
          </div>
        </section>

        <section className="landing-plans container" id="planos" aria-labelledby="plans-title">
          <div className="plans-copy" data-reveal>
            <p className="eyebrow">GRATUITO E PLUS</p>
            <h2 id="plans-title">Começa a explorar.<br />Escolhe como acompanhar.</h2>
            <p>A pesquisa, o mercado e as notícias são públicos. Para as ferramentas pessoais, conhece os limites de cada plano e escolhe o que precisas.</p>
            <Link className="quiet-link" href="/planos">Ver planos e limites <Icon name="arrow-right" size={16} /></Link>
          </div>
          <div className="landing-plan-options" data-reveal>
            <article><span className="eyebrow">GRATUITO</span><h3>O teu ponto de partida.</h3><p>Consulta pública e ferramentas pessoais para começar a acompanhar.</p><span className="plan-preview-limit">Até <strong>{planLimits.freeWatchlist}</strong> instrumentos na lista</span></article>
            <article className="landing-plus"><span className="eyebrow">INVEST.AO PLUS</span><h3>Mais espaço para seguir.</h3><p>Limites alargados na lista e nas comparações para acompanhar mais instrumentos.</p><span className="plan-preview-limit">Até <strong>{planLimits.plusWatchlist}</strong> instrumentos na lista</span></article>
          </div>
        </section>

        <section className="questions-section container" id="perguntas" aria-labelledby="questions-title">
          <div data-reveal><p className="eyebrow">ANTES DE COMEÇAR</p><h2 id="questions-title">Algumas respostas.<br /><span className="muted-text">Sem complicar.</span></h2><a href="mailto:info@invest.ao" className="quiet-link">Fala connosco <Icon name="arrow-up-right" size={16} /></a></div>
          <div className="question-list" data-reveal>{questions.map(([question, answer]) => <details key={question}><summary>{question}<span className="faq-toggle" aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
        </section>
      </main>
      <footer className="site-footer container">
        <div className="footer-heading"><a href="#conteudo" aria-label="invest.ao — início"><SiteBrand /></a><p>O mercado de capitais de Angola.<br />Informação para acompanhar.</p><a href="#conteudo" className="quiet-link">Voltar ao início <Icon name="arrow-up" size={16} /></a></div>
        <div className="footer-information"><span>© {new Date().getFullYear()} invest.ao</span><a href="/policy">Privacidade</a><a href="/planos">Planos</a>{distribution.url && <a href={distribution.url} target="_blank" rel="noopener noreferrer">{distribution.beta ? "iPhone · TestFlight" : "Aplicação para iPhone"}<Icon name="arrow-up-right" size={12} /></a>}<a href="/cookies">Cookies</a><CookiePreferencesButton /><a href="mailto:info@invest.ao">info@invest.ao</a></div>
        <p className="footer-disclaimer">A invest.ao fornece informação para acompanhar o mercado. Não presta aconselhamento financeiro nem executa operações de compra ou venda.</p>
      </footer>
    </div>
  );
}
