import Image from "next/image";
import MarketExplorer from "./market-explorer";
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
      "Consulte o índice sintético Invest.ao, a evolução do mercado e o volume negociado. A data dos dados permite situar a informação de cada sessão.",
    details: [
      "Índice e evolução do mercado",
      "Volume negociado",
      "Estado do mercado e data dos dados",
    ],
    image: "market-overview.png",
    alt: "Ecrã de mercado da Invest.ao com índice sintético, gráfico mensal, data dos dados, volume negociado e títulos a acompanhar.",
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
      "Consulte o preço em kwanzas, a variação e o histórico de cada título. Seleccione um período para analisar a evolução e as estatísticas de preço.",
    details: [
      "Preço em kwanzas e variação",
      "Histórico por período",
      "Abertura, máximo e mínimo",
    ],
    image: "asset-detail.png",
    alt: "Detalhe de um título na Invest.ao com preço em kwanzas, gráfico de um mês, desempenho por período e estatísticas de preço.",
    caption: "Histórico e estatísticas para acompanhar cada título.",
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
      "Compare a evolução de vários títulos no mesmo gráfico. Alterne entre preço e desempenho e seleccione o período de comparação.",
    details: [
      "Vários títulos, um gráfico",
      "Preço ou desempenho",
      "Selecção do período de análise",
    ],
    image: "asset-comparison.png",
    alt: "Comparação de dois títulos na Invest.ao, com linhas azul e laranja, vista de desempenho e período de seis meses seleccionado.",
    caption: "Vários títulos, comparados no mesmo período.",
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
    "As imagens são capturas da aplicação e mostram os valores e as datas do momento da captura. A demonstração interactiva não apresenta cotações de mercado. Este site não fornece cotações em tempo real.",
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
            <a href="#experimentar">Demonstração</a>
            <a href="#perguntas">Perguntas frequentes</a>
          </nav>
          <a className="launch-link" href="#lancamento">
            Em breve para iPhone
          </a>
          <details className="mobile-nav">
            <summary aria-label="Menu de navegação">
              <span /> <span />
            </summary>
            <nav aria-label="Navegação móvel">
              <a href="#aplicacao">A aplicação</a>
              <a href="#experimentar">Demonstração</a>
              <a href="#perguntas">Perguntas frequentes</a>
              <a href="#lancamento">Em breve para iPhone</a>
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
                <a className="solid-button" href="#aplicacao">
                  Explorar a aplicação
                </a>
                <a className="quiet-link" href="#experimentar">
                  Ver demonstração <span aria-hidden="true">→</span>
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
                  src="/screenshots/market-overview.png"
                  alt="A aplicação Invest.ao no iPhone: índice sintético, evolução do mercado e títulos a acompanhar."
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
              Mercado, histórico
              <br />
              <span className="muted-text">e comparação.</span>
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
                  <a className="quiet-link" href="#experimentar">
                    Ver demonstração da interface
                  </a>
                </div>
                <figure className="chapter-visual" data-reveal>
                  <span className="chapter-numeral" aria-hidden="true">
                    {chapter.number}
                  </span>
                  <div className="chapter-phone">
                    <DeviceFrame
                      src={`/screenshots/${chapter.image}`}
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
              <p className="eyebrow">DEMONSTRAÇÃO INTERACTIVA</p>
              <h2 id="try-title">
                Mercado, carteira
                <br />
                <span className="accent-text">e favoritos.</span>
              </h2>
            </div>
            <p>
              Explore os três espaços da aplicação. Alterne entre separadores e
              guarde um título nos favoritos para experimentar a interface.
            </p>
          </div>
          <div data-reveal>
            <MarketExplorer />
          </div>
          <p className="demo-note">
            Pré-visualização interactiva, sem cotações de mercado. Os favoritos
            ficam apenas nesta demonstração e são repostos ao recarregar a
            página.
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
              <a className="solid-button" href="#experimentar">
                Explorar a demonstração
              </a>
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
