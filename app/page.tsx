import Image from "next/image";
import { Suspense } from "react";
import SiteHeader from "./components/site-header";
import SiteBrand from "./components/site-brand";
import Icon from "./components/invest-icon";
import Link from "./components/workspace-link";
import LandingAuth from "./components/landing-auth";
import { CookiePreferencesButton } from "./components/cookie-consent";
import LandingMarket, { LandingMarketLoading } from "./landing-market";
import { appDistribution } from "../lib/app-distribution";
import PageMotion from "./page-motion";
import { SiteSchema } from "./site-schema";
import { pageMetadata, siteDescription, siteTitle } from "../lib/seo";
import "./homepage.css";

export const metadata = pageMetadata({ title: siteTitle, description: siteDescription, path: "/" });

const shortcuts = [
  { icon: "markets", title: "Mercado", description: "Conhece os títulos", href: "/mercado" },
  { icon: "portfolio", title: "Carteira", description: "Reúne os investimentos", href: "/carteira" },
  { icon: "watchlist", title: "A tua lista", description: "Segue o que importa", href: "/lista" },
  { icon: "alert", title: "Alertas", description: "Define os teus preços", href: "/alertas" },
];

const questions = [
  ["O que é a invest.ao?", "A invest.ao reúne o mercado de capitais de Angola, a tua carteira, a tua lista e os teus alertas. Podes consultar preços, comparar instrumentos e acompanhar os teus investimentos no navegador ou no iPhone, com a mesma conta."],
  ["Posso comprar e vender títulos?", "Não. A invest.ao é uma ferramenta de informação e acompanhamento, não uma corretora. Não executa ordens de compra ou venda de títulos nem presta aconselhamento financeiro."],
  ["Os preços são em tempo real?", "Cada preço indica o tipo e a data da referência disponível. A actualização depende das fontes de mercado e não é uma garantia de cotação em tempo real. Confirma sempre a data apresentada em cada instrumento."],
  ["Preciso de instalar a aplicação?", "Não. Pesquisa instrumentos, consulta o mercado, lê notícias e conhece os planos sem iniciar sessão. Para guardar a tua lista, organizar a carteira, criar alertas ou comparar instrumentos, entra na tua conta. No iPhone, podes continuar com a mesma conta."],
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
          <p className="hero-eyebrow"><span aria-hidden="true" /> O MERCADO ANGOLANO, MAIS PERTO</p>
          <h1 id="hero-title">O teu mercado.<br /><span className="accent-text">Uma nova perspectiva.</span></h1>
          <p className="opening-description">Dos preços à tua carteira, vê o mercado de capitais de Angola<br className="desktop-break" /> com mais clareza. No navegador e no iPhone.</p>
          <div className="opening-actions">
            <Link className="solid-button" href="/mercado">Explorar o mercado <Icon name="arrow-right" size={18} /></Link>
            <a className="outline-button" href="#aplicacao">Conhecer a invest.ao <Icon name="arrow-down" size={17} /></a>
          </div>
          <p className="opening-note">Pesquisa e informação de mercado sem iniciar sessão.</p>
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
            <span className="section-aside"><Icon name="markets" size={16} /> Preços de referência · BODIVA</span>
          </div>
          <div className="landing-quotes">
            <Suspense fallback={<LandingMarketLoading />}><LandingMarket /></Suspense>
          </div>
          <p className="market-caption"><Icon name="info" size={14} /> Informação para acompanhar. A invest.ao não executa operações de compra ou venda.</p>
        </section>

        <section className="features-section container" id="aplicacao" aria-labelledby="features-title">
          <div className="section-heading" data-reveal>
            <div><p className="eyebrow">UM LUGAR PARA VER MAIS LONGE</p><h2 id="features-title">Mais contexto.<br /><span className="muted-text">As tuas próprias decisões.</span></h2></div>
            <p className="section-description">Conhece o mercado, organiza os teus investimentos e acompanha o que te interessa.</p>
          </div>
          <div className="feature-grid">
            <article className="feature-card feature-market" id="visao-do-mercado" data-reveal>
              <span className="feature-icon"><Icon name="chart" size={24} /></span>
              <p className="eyebrow">01 / VISÃO DO MERCADO</p>
              <h3>O contexto faz<br />a diferença.</h3>
              <p>Indicador invest.ao, volume da sessão e negócios. Percebe o mercado para lá de um preço isolado.</p>
              <Link className="quiet-link" href="/mercado">Explorar o mercado <Icon name="arrow-up-right" size={16} /></Link>
              <figure className="feature-capture"><Image src="/screenshots/2026-10-20/market-overview.png" width={1320} height={2868} sizes="(max-width: 760px) 240px, 280px" alt="Captura do iPhone com o Indicador invest.ao, o volume e os negócios da sessão de 19 de Outubro de 2026." /><figcaption>Captura do iPhone · dados de 19 out. 2026</figcaption></figure>
            </article>
            <article className="feature-card feature-compare" id="comparar-titulos" data-reveal>
              <span className="feature-icon"><Icon name="exchange" size={24} /></span>
              <p className="eyebrow">02 / COMPARAÇÃO</p>
              <h3>Dois títulos.<br />Uma visão mais clara.</h3>
              <p>Compara a evolução de instrumentos no mesmo período e consulta a variação de preço lado a lado.</p>
              <Link className="quiet-link" href="/comparar">Comparar instrumentos <Icon name="arrow-up-right" size={16} /></Link>
              <figure className="feature-capture"><Image src="/screenshots/2026-10-20/asset-comparison.png" width={1320} height={2868} sizes="(max-width: 760px) 240px, 280px" alt="Captura do iPhone a comparar a evolução de BODIVA e BAI em seis meses, no momento da captura." /><figcaption>Captura do iPhone · valores do momento da captura</figcaption></figure>
            </article>
            <article className="feature-card feature-small" data-reveal>
              <span className="feature-icon"><Icon name="portfolio" size={24} /></span>
              <div><p className="eyebrow">03 / CARTEIRA</p><h3>Os teus investimentos,<br />num só lugar.</h3><p>Regista as tuas posições e acompanha a composição da carteira.</p><Link className="quiet-link" href="/carteira">Organizar carteira <Icon name="arrow-up-right" size={16} /></Link></div>
            </article>
            <article className="feature-card feature-small" data-reveal>
              <span className="feature-icon"><Icon name="alert" size={24} /></span>
              <div><p className="eyebrow">04 / LISTA E ALERTAS</p><h3>Menos procura.<br />Mais acompanhamento.</h3><p>Guarda os teus favoritos e define os preços que merecem a tua atenção.</p><Link className="quiet-link" href="/alertas">Definir alertas <Icon name="arrow-up-right" size={16} /></Link></div>
            </article>
          </div>
          <div className="web-continuation" id="experimentar" data-reveal><span><Icon name="globe" size={20} /> Tudo isto, no teu navegador. A mesma conta no iPhone.</span><Link href="/dashboard" className="quiet-link">Abrir dashboard <Icon name="arrow-right" size={18} /></Link></div>
        </section>

        <section className="companion-section container" id="lancamento" aria-labelledby="companion-title">
          <div className="companion-panel" data-reveal>
            <div className="companion-copy"><p className="eyebrow">INVEST.AO PARA IPHONE</p><h2 id="companion-title">O mercado não fica<br /><span className="accent-text">na secretária.</span></h2><p>A tua lista à mão. Os teus alertas contigo. Continua a acompanhar os teus investimentos com a mesma conta no iPhone.</p>
              {distribution.url ? <a className="solid-button" href={distribution.url} target="_blank" rel="noopener noreferrer">{distribution.beta ? "Experimentar no TestFlight" : "Descarregar na App Store"}<Icon name="arrow-up-right" size={18} /></a> : <Link href="/dashboard" className="solid-button">Abrir dashboard <Icon name="arrow-right" size={18} /></Link>}
              <p className="companion-note">Também disponível na web. A instalação é opcional.</p>
              {distribution.url && distribution.qr && <div className="download-qr"><Image src={distribution.qr} width={72} height={72} alt="QR code para a página oficial da invest.ao para iPhone" unoptimized /><span>Aponta a câmara.<br />Leva a invest.ao contigo.</span></div>}
            </div>
            <figure className="companion-phone"><Image src="/screenshots/2026-10-20/asset-detail.png" width={1320} height={2868} sizes="(max-width: 760px) 220px, 270px" alt="Captura do detalhe de um título na invest.ao para iPhone, com preço, histórico e acesso a comparação e alertas." /><figcaption>Captura do iPhone. Valores e datas do momento da captura.</figcaption></figure>
          </div>
        </section>

        <section className="questions-section container" id="perguntas" aria-labelledby="questions-title">
          <div data-reveal><p className="eyebrow">ANTES DE COMEÇAR</p><h2 id="questions-title">Algumas respostas.<br /><span className="muted-text">Sem complicar.</span></h2><a href="mailto:info@invest.ao" className="quiet-link">Fala connosco <Icon name="arrow-up-right" size={16} /></a></div>
          <div className="question-list" data-reveal>{questions.map(([question, answer]) => <details key={question}><summary>{question}<span className="faq-toggle" aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
        </section>
      </main>
      <footer className="site-footer container">
        <div className="footer-heading"><a href="#conteudo" aria-label="invest.ao — início"><SiteBrand /></a><p>O mercado de capitais de Angola.<br />Informação para acompanhar.</p><a href="#conteudo" className="quiet-link">Voltar ao início <Icon name="arrow-up" size={16} /></a></div>
        <div className="footer-information"><span>© {new Date().getFullYear()} invest.ao</span><a href="/policy">Privacidade</a><a href="/planos">Planos</a><a href="/cookies">Cookies</a><CookiePreferencesButton /><a href="mailto:info@invest.ao">info@invest.ao</a></div>
        <p className="footer-disclaimer">A invest.ao fornece informação para acompanhar o mercado. Não presta aconselhamento financeiro nem executa operações de compra ou venda.</p>
      </footer>
    </div>
  );
}
