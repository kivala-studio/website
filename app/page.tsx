import Image from "next/image";
import MarketExplorer from "./market-explorer";
import DeviceFrame from "./device-frame";
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

const screenshots = [
  {
    id: "visao-do-mercado",
    label: "01 / VISÃO DO MERCADO",
    title: "Começa pelo conjunto.",
    description:
      "Consulta o índice sintético invest.ao, o volume negociado e os títulos que acompanhas. Vê o estado do mercado e a data dos dados para perceberes o contexto de cada sessão.",
    image: "market-overview.png",
    alt: "Ecrã de mercado da invest.ao com índice sintético, gráfico mensal, data dos dados, volume negociado e títulos a acompanhar.",
  },
  {
    id: "detalhe-do-titulo",
    label: "02 / DETALHE DO TÍTULO",
    title: "Conhece cada movimento.",
    description:
      "Abre um título para consultar o preço em kwanzas, a variação e o histórico. Escolhe o período do gráfico e explora o desempenho, a abertura, o máximo e o mínimo, no mesmo ecrã.",
    image: "asset-detail.png",
    alt: "Detalhe de um título na invest.ao com preço em kwanzas, gráfico de um mês, desempenho por período e estatísticas de preço.",
  },
  {
    id: "comparar-titulos",
    label: "03 / COMPARAÇÃO",
    title: "Põe os títulos lado a lado.",
    description:
      "Compara a evolução de vários títulos no mesmo gráfico. Alterna entre preço e desempenho e escolhe o intervalo de tempo para veres como cada um se comportou.",
    image: "asset-comparison.png",
    alt: "Comparação de dois títulos na invest.ao, com linhas azul e laranja, vista de desempenho e período de seis meses seleccionado.",
  },
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Saltar para o conteúdo
      </a>
      <header className="site-header container">
        <a href="#conteudo" aria-label="Invest.ao — início">
          <Brand />
        </a>
        <nav aria-label="Navegação principal">
          <a href="#aplicacao">A aplicação</a>
          <a href="#experimentar">Experimentar</a>
          <a href="#perguntas">Perguntas frequentes</a>
        </nav>
        <a className="header-link" href="#lancamento">
          Para iPhone
        </a>
      </header>
      <main id="conteudo">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy">
          <div className="edition-line">
            <span>UMA PERSPECTIVA SOBRE O MERCADO ANGOLANO</span>
            <span>FEITA EM ANGOLA · AO</span>
          </div>
          <div className="hero-heading">
            <h1 id="hero-title">
              O teu mercado.
              <br />
              <em>A tua perspectiva.</em>
            </h1>
          </div>
          <div className="hero-bottom">
            <span className="hero-index">
              <span className="status-dot" /> INVEST.AO
              <br />
              <span>Mercado de capitais, mais perto.</span>
            </span>
            <p>
              Conhece os títulos. Acompanha a tua carteira.
              <br className="desktop-break" /> Segue o que acontece no mercado
              angolano.
              <br className="desktop-break" /> Tudo começa com uma visão mais
              clara.
            </p>
            <div className="hero-actions">
              <a className="primary-link" href="#aplicacao">Explorar a aplicação <span aria-hidden="true">↓</span></a>
              <a className="hero-secondary" href="#lancamento">Em breve para iPhone</a>
            </div>
          </div>
          </div>
          <figure className="hero-device">
            <div className="hero-device-stage">
              <div className="hero-phone hero-phone-left" aria-hidden="true"><DeviceFrame src="/screenshots/asset-detail.png" alt="" /></div>
              <div className="hero-phone hero-phone-main"><DeviceFrame src="/screenshots/market-overview.png" alt="A aplicação invest.ao no iPhone: índice sintético, evolução do mercado e títulos a acompanhar." hero /></div>
              <div className="hero-phone hero-phone-right" aria-hidden="true"><DeviceFrame src="/screenshots/asset-comparison.png" alt="" /></div>
            </div>
            <figcaption>Captura da aplicação · Valores à data da captura</figcaption>
          </figure>
        </section>
        <section className="screenshots-section container" id="aplicacao" aria-labelledby="screenshots-title">
          <div className="screenshots-heading">
            <h2 id="screenshots-title">Do mercado ao detalhe.</h2>
            <p>A invest.ao, por dentro.</p>
          </div>
          <div className="screenshots-grid">
            {screenshots.map((screen) => (
              <article className="screenshot-feature" key={screen.id} aria-labelledby={screen.id}>
                <div className="screenshot-copy">
                  <span className="label">{screen.label}</span>
                  <h3 id={screen.id}>{screen.title}</h3>
                  <p>{screen.description}</p>
                  <a className="text-link" href="#experimentar">Experimentar a interface</a>
                </div>
                <figure>
                  <div className="screenshot-display">
                    <DeviceFrame src={`/screenshots/${screen.image}`} alt={screen.alt} />
                  </div>
                </figure>
              </article>
            ))}
          </div>
          <p className="screenshots-note">Capturas da aplicação. Os valores e as datas apresentados pertencem ao momento da captura e não são cotações em tempo real.</p>
        </section>
        <section
          className="application"
          id="experimentar"
          aria-labelledby="application-title"
        >
          <div className="container">
            <div className="application-heading">
              <h2 id="application-title">O mercado, ao teu alcance.</h2>
              <span className="label">01 / EXPLORA A INVEST.AO</span>
            </div>
            <MarketExplorer />
            <p className="demo-note">
              Pré-visualização interactiva, sem cotações de mercado. Os
              favoritos ficam apenas nesta demonstração e são repostos ao
              recarregar a página.
            </p>
          </div>
        </section>
        <section
          className="perspective container"
          aria-labelledby="perspective-title"
        >
          <div className="section-heading">
            <span className="label">02 / DO CONJUNTO AO DETALHE</span>
            <span className="section-rule" />
          </div>
          <div className="perspective-body">
            <div className="perspective-intro">
              <h2 id="perspective-title">
                Mais contexto.
                <br />
                <em>Critério teu.</em>
              </h2>
              <p>
                Há um mercado para conhecer.
                <br />E uma forma tua de o acompanhar.
              </p>
              <a className="text-link" href="#lancamento">
                Em breve para iPhone
              </a>
            </div>
            <div className="feature-list">
              <article className="feature-row">
                <span className="feature-number">01</span>
                <div>
                  <h3>Conhece antes de acompanhar.</h3>
                  <p>
                    Explora acções e obrigações. Consulta os títulos e os seus
                    emitentes para perceberes o que faz parte do mercado
                    angolano.
                  </p>
                  <span className="feature-detail">
                    TÍTULOS / EMITENTES / INFORMAÇÃO
                  </span>
                </div>
              </article>
              <article className="feature-row">
                <span className="feature-number">02</span>
                <div>
                  <h3>Vê a carteira por inteiro.</h3>
                  <p>
                    Reúne as tuas posições e acompanha a composição da tua
                    carteira. Passa da visão geral ao detalhe de cada título.
                  </p>
                  <span className="feature-detail">
                    POSIÇÕES / COMPOSIÇÃO / EVOLUÇÃO
                  </span>
                </div>
              </article>
              <article className="feature-row">
                <span className="feature-number">03</span>
                <div>
                  <h3>Dá atenção ao que te interessa.</h3>
                  <p>
                    Guarda os teus favoritos e consulta as actualizações dos
                    títulos que acompanhas. A tua lista, com o teu critério.
                  </p>
                  <span className="feature-detail">
                    FAVORITOS / ACTUALIZAÇÕES / CONTEXTO
                  </span>
                </div>
              </article>
            </div>
          </div>
        </section>
        <section className="closing container" aria-labelledby="launch-title">
          <div className="launch" id="lancamento">
            <span className="label">03 / O PRÓXIMO PASSO</span>
            <h2 id="launch-title">
              O teu mercado.
              <br />
              <em>Contigo.</em>
            </h2>
            <div className="launch-status">
              <span className="status-dot" /> Em preparação para iPhone
            </div>
            <p>
              Estamos a preparar a aplicação. Quando estiver disponível,
              encontras aqui o link para a App Store.
            </p>
          </div>
          <div className="faq" id="perguntas">
            <span className="label">ANTES DE COMEÇARES</span>
            <h2>Vale a pena saber.</h2>
            <div className="faq-list">
              {questions.map(([question, answer], index) => (
                <details key={question}>
                  <summary>
                    <span className="question-number">0{index + 1}</span>
                    <span>{question}</span>
                    <span className="question-toggle" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
            <p className="faq-footnote">
              Informação para acompanhar.
              <br />
              As decisões continuam a ser tuas.
            </p>
          </div>
        </section>
      </main>
      <footer className="container">
        <div className="footer-top">
          <a href="#conteudo" aria-label="Invest.ao — início">
            <Brand />
          </a>
          <span>De Angola. Para o teu dia-a-dia.</span>
          <a className="back-top" href="#conteudo">
            Voltar ao início <span aria-hidden="true">↑</span>
          </a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Invest.ao</span>
          <p>
            Informação para acompanhar o mercado. Não constitui aconselhamento
            financeiro nem uma plataforma de negociação.
          </p>
        </div>
      </footer>
    </>
  );
}
