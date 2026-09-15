import Image from "next/image";
import MarketExplorer from "./market-explorer";
import DeviceFrame from "./device-frame";
import PageMotion from "./page-motion";
import "./landing.css";
import "./product-layout.css";

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
        Começa
        <br />
        pelo conjunto.
      </>
    ),
    description:
      "Consulta o índice sintético invest.ao, o volume negociado e os títulos que acompanhas. O contexto de cada sessão, num só lugar.",
    details: [
      "Índice e evolução do mercado",
      "Volume negociado",
      "Estado do mercado e data dos dados",
    ],
    image: "market-overview.png",
    alt: "Ecrã de mercado da invest.ao com índice sintético, gráfico mensal, data dos dados, volume negociado e títulos a acompanhar.",
    caption: "O mercado angolano, numa visão mais clara.",
  },
  {
    id: "detalhe-do-titulo",
    number: "02",
    label: "DETALHE DO TÍTULO",
    title: (
      <>
        Conhece cada
        <br />
        movimento.
      </>
    ),
    description:
      "Abre um título para consultar o preço em kwanzas, a variação e o histórico. Do primeiro olhar ao detalhe que faz a diferença.",
    details: [
      "Preço e variação em kwanzas",
      "Histórico por período",
      "Abertura, máximo e mínimo",
    ],
    image: "asset-detail.png",
    alt: "Detalhe de um título na invest.ao com preço em kwanzas, gráfico de um mês, desempenho por período e estatísticas de preço.",
    caption: "Mais contexto para formares a tua perspectiva.",
  },
  {
    id: "comparar-titulos",
    number: "03",
    label: "COMPARAÇÃO",
    title: (
      <>
        Lado a lado.
        <br />
        Tudo mais claro.
      </>
    ),
    description:
      "Compara a evolução de vários títulos no mesmo gráfico. Escolhe o intervalo de tempo e vê como cada um se comportou.",
    details: [
      "Vários títulos, um gráfico",
      "Preço ou desempenho",
      "Períodos à tua escolha",
    ],
    image: "asset-comparison.png",
    alt: "Comparação de dois títulos na invest.ao, com linhas azul e laranja, vista de desempenho e período de seis meses seleccionado.",
    caption: "O conjunto e o detalhe, na mesma perspectiva.",
  },
];

const questions = [
  [
    "O que posso fazer na Invest.ao?",
    "Explorar títulos do mercado angolano, organizar a tua carteira e guardar favoritos. Uma aplicação para reunir a informação que queres acompanhar.",
  ],
  [
    "Posso comprar e vender títulos?",
    "A Invest.ao é uma ferramenta de informação e acompanhamento. Não executa ordens de compra ou venda.",
  ],
  [
    "Quando posso descarregar a aplicação?",
    "O lançamento para iPhone está em preparação. O link oficial da App Store será publicado nesta página quando estiver disponível.",
  ],
];

export default function Home() {
  return (
    <div className="landing-page">
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
            <a href="#experimentar">Experimentar</a>
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
              <a href="#experimentar">Experimentar</a>
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
              <p className="eyebrow opening-enter">
                <span className="status-dot" /> FEITA EM ANGOLA. PARA O TEU
                DIA-A-DIA.
              </p>
              <h1 id="hero-title">
                <span>O teu mercado.</span>
                <span>A tua</span>
                <span className="accent-text">perspectiva.</span>
              </h1>
              <p className="opening-description opening-enter">
                Conhece os títulos. Acompanha a tua carteira.
                <br />
                Segue o que acontece no mercado angolano.
              </p>
              <div className="opening-actions opening-enter">
                <a className="solid-button" href="#aplicacao">
                  Explorar a aplicação
                </a>
                <a className="quiet-link" href="#experimentar">
                  Experimentar <span aria-hidden="true">→</span>
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
                  alt="A aplicação invest.ao no iPhone: índice sintético, evolução do mercado e títulos a acompanhar."
                  hero
                />
              </div>
            </figure>
            <div className="opening-baseline">
              <span>MERCADO DE CAPITAIS, MAIS PERTO.</span>
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
            A TUA PERSPECTIVA COMEÇA AQUI
          </p>
          <h2 id="perspective-title" className="statement" data-reveal>
            Há um mercado
            <br />
            para conhecer.
            <br />
            <span className="muted-text">E uma forma </span>
            <span className="accent-text">tua</span>
            <br />
            <span className="muted-text">de o acompanhar.</span>
          </h2>
          <div className="principles">
            <article data-reveal>
              <span className="principle-symbol" aria-hidden="true">
                01
              </span>
              <h3>Conhece antes de acompanhar.</h3>
              <p>
                Explora acções e obrigações. Conhece os títulos e os seus
                emitentes para perceberes o que faz parte do mercado angolano.
              </p>
            </article>
            <article data-reveal>
              <span className="principle-symbol" aria-hidden="true">
                02
              </span>
              <h3>Vê a carteira por inteiro.</h3>
              <p>
                Reúne as tuas posições e acompanha a composição da tua carteira.
                Passa da visão geral ao detalhe de cada título.
              </p>
            </article>
            <article data-reveal>
              <span className="principle-symbol" aria-hidden="true">
                03
              </span>
              <h3>Dá atenção ao que te interessa.</h3>
              <p>
                Guarda os teus favoritos e consulta as actualizações dos títulos
                que acompanhas. A tua lista, com o teu critério.
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
            <p className="eyebrow">A INVEST.AO, POR DENTRO</p>
            <h2 id="product-title">
              Do mercado
              <br />
              <span className="muted-text">ao detalhe.</span>
            </h2>
            <p>
              Três perspectivas.
              <br />
              Uma visão mais clara.
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
                    Experimentar a interface
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
              <p className="eyebrow">EXPLORA AO TEU RITMO</p>
              <h2 id="try-title">
                Menos distância.
                <br />
                <span className="accent-text">Mais contexto.</span>
              </h2>
            </div>
            <p>
              Experimenta a interface. Explora os títulos, muda de perspectiva e
              guarda o que te interessa.
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
            <p className="eyebrow">ANTES DE COMEÇARES</p>
            <h2 id="questions-title">
              Vale a pena
              <br />
              <span className="muted-text">saber.</span>
            </h2>
            <p className="questions-caption">
              Informação para acompanhar.
              <br />
              As decisões continuam a ser tuas.
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
              O teu mercado.
              <br />
              <span>Contigo.</span>
            </h2>
            <div className="finale-bottom">
              <p>
                Estamos a preparar a aplicação. Quando estiver disponível,
                encontras aqui o link para a App Store.
              </p>
              <a className="solid-button" href="#experimentar">
                Entretanto, explora
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
            De Angola.
            <br />
            Para o teu dia-a-dia.
          </p>
          <a href="#conteudo" className="quiet-link">
            Voltar ao início <span aria-hidden="true">↑</span>
          </a>
        </div>
        <div className="footer-information">
          <span>© {new Date().getFullYear()} Invest.ao</span>
          <a href="/policy">Política de privacidade</a>
          <p>
            Informação para acompanhar o mercado. Não constitui aconselhamento
            financeiro nem uma plataforma de negociação.
          </p>
        </div>
        <div className="footer-wordmark" aria-hidden="true">
          invest<span>.</span>ao
        </div>
      </footer>
    </div>
  );
}
