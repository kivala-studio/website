import Image from "next/image";
import Link from "next/link";
import DeviceFrame from "./device-frame";
import PageMotion from "./page-motion";
import { SiteSchema } from "./site-schema";
import { pageMetadata, siteDescription, siteTitle } from "../lib/seo";
import "./landing.css";
import "./product-layout.css";

export const metadata = pageMetadata({
  title: siteTitle,
  description: siteDescription,
  path: "/",
});

function Brand() {
  return (
    <span className="brand">
      <Image src="/investao-logo.svg" alt="" width={36} height={36} />
      <span>
        invest<span className="brand-dot">.</span>ao
      </span>
    </span>
  );
}

const chapters = [
  {
    id: "visao-do-mercado",
    number: "01",
    label: "VISÃO DO MERCADO",
    title: (
      <>
        O mercado,
        <br />
        numa visão geral.
      </>
    ),
    description:
      "Consulte o Indicador invest.ao, o volume da sessão e o número de negócios. Acompanhe os títulos da sua lista com a data dos fechos de referência.",
    details: [
      "Indicador invest.ao e evolução do mercado",
      "Volume da sessão e número de negócios",
      "Estado do mercado e data dos dados",
    ],
    image: "market-overview.png",
    alt: "Início da Invest.ao com o Indicador invest.ao, fechos de 19 de Outubro de 2026, volume da sessão, número de negócios e lista de acompanhamento.",
    caption: "Evolução, volume e data dos dados do mercado angolano.",
  },
  {
    id: "detalhe-do-titulo",
    number: "02",
    label: "DETALHE DO TÍTULO",
    title: (
      <>
        Preço e histórico
        <br />
        de cada título.
      </>
    ),
    description:
      "Consulte o preço em kwanzas, a variação e o histórico de cada título. Seleccione um período para analisar a evolução, comparar títulos ou criar um alerta.",
    details: [
      "Preço em kwanzas e variação",
      "Histórico por período",
      "Comparação e criação de alertas",
    ],
    image: "asset-detail.png",
    alt: "Detalhe da acção BODIVA na Invest.ao, com preço em kwanzas, histórico de três meses e botões para comparar e criar um alerta.",
    caption: "Preço, histórico e alertas para acompanhar cada título.",
  },
  {
    id: "comparar-titulos",
    number: "03",
    label: "COMPARAÇÃO",
    title: (
      <>
        Compare títulos,
        <br />
        lado a lado.
      </>
    ),
    description:
      "Compare a evolução de vários títulos no mesmo gráfico. Consulte a variação de preço no período comum e seleccione o período de comparação.",
    details: [
      "Vários títulos, um gráfico",
      "Variação de preço no período comum",
      "Selecção do período de análise",
    ],
    image: "asset-comparison.png",
    alt: "Comparação entre BODIVA e BAI na Invest.ao, com a variação de preço em linhas azul e laranja e período de seis meses seleccionado.",
    caption: "Vários títulos, comparados no mesmo período.",
  },
  {
    id: "actividade-do-mercado",
    number: "04",
    label: "ACTIVIDADE",
    title: (
      <>
        Os movimentos,
        <br />
        com contexto.
      </>
    ),
    description:
      "Acompanhe os movimentos importantes do mercado e os títulos da sua lista. Consulte as notificações por data e alterne entre movimentos e notícias.",
    details: [
      "Movimentos importantes do mercado",
      "Actualizações da lista de acompanhamento",
      "Movimentos e notícias organizados por data",
    ],
    image: "activity.png",
    alt: "Actividade da Invest.ao com separadores de movimentos e notícias, notificações de variações de preço e actualizações da lista de acompanhamento.",
    caption: "Movimentos e notificações dos títulos que acompanha.",
  },
];

const questions = [
  [
    "O que é a Invest.ao?",
    "A Invest.ao é uma aplicação para acompanhar o mercado de capitais de Angola. Reúne informação sobre acções e outros títulos, preços em kwanzas, histórico e comparação, com espaços para organizar a carteira e guardar favoritos.",
  ],
  [
    "Posso comprar e vender títulos?",
    "Não. A Invest.ao é uma ferramenta de informação e acompanhamento, não uma corretora. Não executa ordens de compra ou venda de títulos.",
  ],
  [
    "A aplicação presta aconselhamento financeiro?",
    "Não. A informação apresentada destina-se ao acompanhamento do mercado e não constitui aconselhamento financeiro nem uma recomendação de investimento.",
  ],
  [
    "Os valores apresentados neste site são actuais?",
    "As imagens desta página são capturas da aplicação e mostram os valores e as datas do momento da captura. No dashboard, consulte a data e o estado de cada referência de mercado.",
  ],
  [
    "Quando posso descarregar a aplicação?",
    "O lançamento para iPhone está em preparação. O link oficial da App Store será publicado nesta página quando estiver disponível.",
  ],
];

export default function Home() {
  return (
    <div className="landing-page">
      <SiteSchema />
      <PageMotion />
      <a className="skip-link" href="#conteudo">
        Saltar para o conteúdo
      </a>
      <header className="masthead">
        <div className="container masthead-inner">
          <a href="#conteudo" aria-label="Invest.ao — início">
            <Brand />
          </a>
          <nav className="desktop-nav" aria-label="Navegação principal">
            <a href="#aplicacao">A aplicação</a>
            <a href="#experimentar">Explorar na web</a>
            <a href="#perguntas">Perguntas frequentes</a>
          </nav>
          <Link className="launch-link dashboard-link" href="/dashboard">
            Dashboard <span aria-hidden="true">→</span>
          </Link>
          <details className="mobile-nav">
            <summary aria-label="Menu de navegação">
              <span /> <span />
            </summary>
            <nav aria-label="Navegação móvel">
              <a href="#aplicacao">A aplicação</a>
              <a href="#experimentar">Explorar na web</a>
              <a href="#perguntas">Perguntas frequentes</a>
              <Link href="/dashboard">Ir para o dashboard</Link>
            </nav>
          </details>
        </div>
      </header>
      <main id="conteudo">
        <section className="opening" aria-labelledby="hero-title">
          <div className="opening-glow" aria-hidden="true" />
          <div className="container opening-layout">
            <div className="opening-copy">
              <h1 id="hero-title">
                <span>O mercado </span>
                <span>de capitais </span>
                <span>de Angola. </span>
                <span className="accent-text">Mais claro.</span>
              </h1>
              <p className="opening-description opening-enter">
                A Invest.ao é a aplicação para acompanhar acções e outros títulos
                do mercado angolano. Consulte preços e histórico, organize a
                carteira e guarde os seus favoritos.
              </p>
              <div className="opening-actions opening-enter">
                <Link className="solid-button" href="/dashboard">
                  Ir para o dashboard <span aria-hidden="true">→</span>
                </Link>
                <a className="quiet-link" href="#aplicacao">
                  Conhecer a aplicação <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>
            <figure className="opening-visual">
              <div className="orbital-stage" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="opening-phone">
                <DeviceFrame
                  src="/screenshots/2026-10-20/market-overview.png"
                  alt="A aplicação Invest.ao no iPhone: panorama do mercado, Indicador invest.ao e lista de acompanhamento."
                  hero
                />
              </div>
            </figure>
            <div className="opening-baseline">
              <span>INFORMAÇÃO SOBRE O MERCADO ANGOLANO.</span>
              <a href="#perspectiva">
                DESCOBRIR{" "}
                <span className="scroll-indicator" aria-hidden="true">
                  ↓
                </span>
              </a>
              <span>
                LUANDA, ANGOLA <span className="location-dot" />
              </span>
            </div>
          </div>
        </section>
        <section
          className="intro-section container"
          id="perspectiva"
          aria-labelledby="perspective-title"
        >
          <p className="eyebrow" data-reveal>
            ACOMPANHAR O MERCADO DE CAPITAIS
          </p>
          <h2 id="perspective-title" className="statement" data-reveal>
            Informação do mercado.
            <br />
            <span className="muted-text">Carteira organizada.</span>
            <br />
            <span className="accent-text">Tudo numa aplicação.</span>
          </h2>
          <div className="principles">
            <article data-reveal>
              <span className="principle-symbol" aria-hidden="true">
                01
              </span>
              <h3>Conheça os títulos e os emitentes.</h3>
              <p>
                Consulte os títulos do mercado angolano, identifique os emitentes
                e acompanhe a evolução dos preços ao longo do tempo.
              </p>
            </article>
            <article data-reveal>
              <span className="principle-symbol" aria-hidden="true">
                02
              </span>
              <h3>Organize a sua carteira.</h3>
              <p>
                Reúna as suas posições para acompanhar a composição da carteira
                e consultar o detalhe de cada título.
              </p>
            </article>
            <article data-reveal>
              <span className="principle-symbol" aria-hidden="true">
                03
              </span>
              <h3>Acompanhe os seus favoritos.</h3>
              <p>
                Guarde os títulos que pretende acompanhar numa lista de favoritos
                e aceda à respectiva informação num só lugar.
              </p>
            </article>
          </div>
        </section>
        <section
          className="product-story"
          id="aplicacao"
          aria-labelledby="product-title"
        >
          <div className="container story-heading" data-reveal>
            <p className="eyebrow">FUNCIONALIDADES DA INVEST.AO</p>
            <h2 id="product-title">
              Mercado, histórico,
              <br />
              <span className="muted-text">comparação e actividade.</span>
            </h2>
            <p>
              Do contexto de cada sessão
              <br />
              ao detalhe de cada título.
            </p>
          </div>
          {chapters.map((chapter) => (
            <article
              className="product-chapter"
              key={chapter.id}
              aria-labelledby={chapter.id}
            >
              <div className="container chapter-layout">
                <div className="chapter-copy" data-reveal>
                  <p className="eyebrow">
                    <span>{chapter.number}</span> {chapter.label}
                  </p>
                  <h3 id={chapter.id}>{chapter.title}</h3>
                  <p className="chapter-description">{chapter.description}</p>
                  <ul role="list">
                    {chapter.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                  <Link className="quiet-link" href="/dashboard">
                    Explorar no dashboard
                  </Link>
                </div>
                <figure className="chapter-visual" data-reveal>
                  <span className="chapter-numeral" aria-hidden="true">
                    {chapter.number}
                  </span>
                  <div className="chapter-phone">
                    <DeviceFrame
                      src={`/screenshots/2026-10-20/${chapter.image}`}
                      alt={chapter.alt}
                    />
                  </div>
                  <figcaption>{chapter.caption}</figcaption>
                </figure>
              </div>
            </article>
          ))}
          <p className="container capture-note">
            Capturas da aplicação. Os valores e as datas apresentados pertencem
            ao momento da captura e não são cotações em tempo real.
          </p>
        </section>
        <section
          className="try-section container"
          id="experimentar"
          aria-labelledby="try-title"
        >
          <div className="split-heading" data-reveal>
            <div>
              <p className="eyebrow">DISPONÍVEL NA WEB</p>
              <h2 id="try-title">
                Mercado, carteira
                <br />
                <span className="accent-text">e favoritos.</span>
              </h2>
            </div>
            <p>
              Consulte o mercado e as notícias no dashboard. Entre na sua conta
              para acompanhar a carteira, guardar favoritos e configurar alertas.
            </p>
          </div>
          <div data-reveal>
            <Link className="solid-button" href="/dashboard">
              Ir para o dashboard <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="demo-note">
            Pode explorar o mercado sem conta. Para guardar os seus dados,
            use a mesma conta na web e no iPhone.
          </p>
        </section>
        <section
          className="questions-section container"
          id="perguntas"
          aria-labelledby="questions-title"
        >
          <div data-reveal>
            <p className="eyebrow">SOBRE A APLICAÇÃO</p>
            <h2 id="questions-title">
              Perguntas
              <br />
              <span className="muted-text">frequentes.</span>
            </h2>
            <p className="questions-caption">
              Funcionalidades, informação
              <br />
              e disponibilidade da Invest.ao.
            </p>
          </div>
          <div className="question-list" data-reveal>
            {questions.map(([question, answer], index) => (
              <details key={question}>
                <summary>
                  <span className="faq-index">0{index + 1}</span>
                  <span>{question}</span>
                  <span className="faq-toggle" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section
          className="finale"
          id="lancamento"
          aria-labelledby="launch-title"
        >
          <div className="container" data-reveal>
            <p className="eyebrow">
              <span className="status-dot" /> EM PREPARAÇÃO PARA IPHONE
            </p>
            <h2 id="launch-title">
              Em breve,
              <br />
              <span>no seu iPhone.</span>
            </h2>
            <div className="finale-bottom">
              <p>
                O lançamento está em preparação. O link oficial da App Store
                será publicado nesta página quando a aplicação estiver disponível.
              </p>
              <Link className="solid-button" href="/dashboard">
                Começar na web <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer container">
        <div className="footer-heading">
          <a href="#conteudo" aria-label="Invest.ao — início">
            <Brand />
          </a>
          <p>
            O mercado de capitais de Angola.
            <br />
            Informação para acompanhar.
          </p>
          <a href="#conteudo" className="quiet-link">
            Voltar ao início <span aria-hidden="true">↑</span>
          </a>
        </div>
        <div className="footer-information">
          <span>© {new Date().getFullYear()} Invest.ao</span>
          <a href="/policy">Política de privacidade</a>
          <a href="mailto:info@invest.ao">Contacto: info@invest.ao</a>
          <p>
            A Invest.ao fornece informação para acompanhar o mercado. Não presta
            aconselhamento financeiro nem executa operações de compra ou venda.
          </p>
        </div>
        <div className="footer-wordmark" aria-hidden="true">
          invest<span>.</span>ao
        </div>
      </footer>
    </div>
  );
}
