import Image from "next/image";
import MarketExplorer from "./market-explorer";

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
          <a href="#perguntas">Perguntas frequentes</a>
        </nav>
        <a className="header-link" href="#lancamento">
          Para iPhone <span aria-hidden="true">↗</span>
        </a>
      </header>
      <main id="conteudo">
        <section className="hero container" aria-labelledby="hero-title">
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
            <div className="hero-location">
              <span>AO</span>
              <p>
                Acções.
                <br />
                Obrigações.
                <br />O mercado angolano.
              </p>
            </div>
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
            <a className="primary-link" href="#aplicacao">
              Explorar a aplicação <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>
        <section
          className="application"
          id="aplicacao"
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
                Em breve para iPhone <span aria-hidden="true">↗</span>
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
            <span className="launch-signature" aria-hidden="true">
              invest.ao ↗
            </span>
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
