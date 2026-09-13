import Image from "next/image";

function Brand() {
  return (
    <span className="brand">
      <Image src="/investao-logo.svg" alt="" width={38} height={38} />
      <span>
        invest<span className="brand-dot">.</span>ao
      </span>
    </span>
  );
}

const assets = [
  {
    ticker: "BAI",
    name: "Banco Angolano de Investimentos",
    type: "Acção",
    price: "64.500",
    change: "+2,38%",
  },
  {
    ticker: "BCGA",
    name: "Banco Caixa Geral Angola",
    type: "Acção",
    price: "12.800",
    change: "+1,16%",
  },
];

function MarketPreview() {
  return (
    <figure className="market-preview">
      <div className="preview-toolbar">
        <span>Mercado</span>
        <span className="preview-caption">
          PRÉ-VISUALIZAÇÃO · DADOS FICTÍCIOS
        </span>
      </div>
      <div className="preview-body">
        <div className="market-overview">
          <span className="label">A TUA LISTA, NUM SÓ LUGAR</span>
          <h3>
            O que estás
            <br />a acompanhar.
          </h3>
          <p>
            Títulos, preços e informação.
            <br />
            Sem perder o contexto.
          </p>
          <span className="watchlist-count">
            02 <span>títulos na lista de exemplo</span>
          </span>
        </div>
        <div className="market-table-wrap">
          <table>
            <caption className="sr-only">
              Exemplo ilustrativo de uma lista de títulos. Preços e variações
              fictícios.
            </caption>
            <thead>
              <tr>
                <th scope="col">Título</th>
                <th scope="col">Preço / Kz</th>
                <th scope="col">Variação</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.ticker}>
                  <th scope="row">
                    <span className="ticker">{asset.ticker}</span>
                    <span className="company-name">{asset.name}</span>
                    <span className="asset-type">{asset.type}</span>
                  </th>
                  <td>{asset.price}</td>
                  <td className="positive">{asset.change}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="market-note">
            <span className="status-dot" /> Uma lista escolhida por ti. Uma
            visão sempre tua.
          </div>
        </div>
      </div>
      <figcaption>
        Uma ilustração das funcionalidades de acompanhamento. Não é uma cotação
        de mercado nem uma captura da aplicação.
      </figcaption>
    </figure>
  );
}

const features = [
  {
    number: "01",
    name: "Conhece o mercado.",
    text: "Explora acções e obrigações do mercado angolano. Consulta a informação de cada título antes de decidires o que acompanhar.",
    detail: "Títulos · Emitentes · Informação",
  },
  {
    number: "02",
    name: "Organiza a tua carteira.",
    text: "Reúne as tuas posições e acompanha a composição da tua carteira. O conjunto e o detalhe, no mesmo lugar.",
    detail: "Posições · Carteira · Evolução",
  },
  {
    number: "03",
    name: "Segue o que te interessa.",
    text: "Cria a tua lista de favoritos e consulta as actualizações do mercado e dos títulos que acompanhas.",
    detail: "Favoritos · Actualizações · Contexto",
  },
];

const questions = [
  [
    "O que posso fazer na Invest.ao?",
    "Acompanhar o mercado de capitais angolano, explorar títulos, organizar a tua carteira e guardar favoritos para consultar informação num só lugar.",
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
        <a href="#" aria-label="Invest.ao — início">
          <Brand />
        </a>
        <nav aria-label="Navegação principal">
          <a href="#funcionalidades">A aplicação</a>
          <a href="#perguntas">Perguntas frequentes</a>
        </nav>
        <a className="header-link" href="#lancamento">
          Em breve para iPhone <span aria-hidden="true">↗</span>
        </a>
      </header>
      <main id="conteudo">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="label">
              <span className="status-dot" /> INVEST.AO / MERCADO DE CAPITAIS
            </span>
            <h1 id="hero-title">
              O mercado
              <br />
              angolano.
              <br />
              <span>Mais perto.</span>
            </h1>
            <p>
              Uma aplicação para conheceres os títulos, acompanhares a tua
              carteira e seguires o que acontece no mercado angolano.
            </p>
            <a className="primary-link" href="#funcionalidades">
              Conhecer a aplicação <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="brand-panel">
            <div className="panel-top">
              <span>CONSTRUÍDA EM ANGOLA</span>
              <span>AO</span>
            </div>
            <Image
              className="hero-logo"
              src="/investao-logo.svg"
              alt="Monograma IAO, o logótipo da Invest.ao"
              width={1254}
              height={1254}
              priority
            />
            <div className="panel-bottom">
              <span>
                O teu mercado.
                <br />A tua perspectiva.
              </span>
              <span className="panel-index">01 — AO</span>
            </div>
          </div>
        </section>
        <section
          className="product-section container"
          id="funcionalidades"
          aria-labelledby="product-title"
        >
          <div className="section-intro">
            <span className="label">A APLICAÇÃO</span>
            <h2 id="product-title">
              Informação para acompanhar.
              <br />
              <span>Espaço para decidir.</span>
            </h2>
          </div>
          <MarketPreview />
          <div className="feature-list">
            {features.map((feature) => (
              <article className="feature-row" key={feature.number}>
                <span className="feature-number">{feature.number}</span>
                <h3>{feature.name}</h3>
                <div>
                  <p>{feature.text}</p>
                  <span className="feature-detail">{feature.detail}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="faq container" id="perguntas">
          <div>
            <span className="label">PERGUNTAS FREQUENTES</span>
            <h2>
              Antes de
              <br />
              começares.
            </h2>
          </div>
          <div className="faq-list">
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="launch" id="lancamento">
          <div className="container launch-inner">
            <div>
              <span className="label">INVEST.AO PARA IPHONE</span>
              <h2>
                O próximo passo
                <br />
                está a chegar.
              </h2>
            </div>
            <div className="launch-information">
              <span className="launch-status">
                <span className="status-dot" /> Lançamento em preparação
              </span>
              <p>
                Estamos a preparar a aplicação.
                <br />
                Quando estiver disponível, encontras aqui o link para a App
                Store.
              </p>
              <a href="#conteudo">
                Voltar ao início <span aria-hidden="true">↑</span>
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="container">
        <div className="footer-top">
          <a href="#" aria-label="Invest.ao — início">
            <Brand />
          </a>
          <span>Feita em Angola.</span>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Invest.ao</span>
          <p>
            Informação para acompanhar o mercado. Não constitui aconselhamento
            financeiro nem uma plataforma de negociação. Os valores de exemplo
            são fictícios.
          </p>
        </div>
      </footer>
    </>
  );
}
