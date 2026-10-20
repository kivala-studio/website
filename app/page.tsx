import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import LandingMarket, { LandingMarketLoading } from "./landing-market";
import { appDistribution } from "../lib/app-distribution";
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
      <Image src="/investao-app-icon.jpg" alt="" width={36} height={36} />
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
    href: "/mercado",
    action: "Explorar o mercado",
    label: "VISÃO DO MERCADO",
    title: (
      <>
        O mercado,
        <br />
        numa visão geral.
      </>
    ),
    description:
      "Consulta o Indicador invest.ao, o volume da sessão e o número de negócios. Acompanha os títulos da tua lista com a data dos fechos de referência.",
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
    href: "/mercado",
    action: "Explorar o mercado",
    label: "DETALHE DO TÍTULO",
    title: (
      <>
        Preço e histórico
        <br />
        de cada título.
      </>
    ),
    description:
      "Consulta o preço em kwanzas, a variação e o histórico de cada título. Selecciona um período para analisar a evolução, comparar títulos ou criar um alerta.",
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
    href: "/comparar",
    action: "Comparar instrumentos",
    label: "COMPARAÇÃO",
    title: (
      <>
        Compara títulos,
        <br />
        lado a lado.
      </>
    ),
    description:
      "Compara a evolução de vários títulos no mesmo gráfico. Consulta a variação de preço no período comum e selecciona o período de comparação.",
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
    href: "/actividade",
    action: "Ver actividade",
    label: "ACTIVIDADE",
    title: (
      <>
        Os movimentos,
        <br />
        com contexto.
      </>
    ),
    description:
      "Acompanha os movimentos importantes do mercado e os títulos da tua lista. Consulta as notificações por data e alterna entre movimentos e notícias.",
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
    "A invest.ao reúne o mercado de capitais de Angola, a tua carteira, a tua lista e os teus alertas. Podes consultar preços, comparar instrumentos e acompanhar os teus investimentos no navegador ou no iPhone, com a mesma conta.",
  ],
  [
    "Posso comprar e vender títulos?",
    "Não. A Invest.ao é uma ferramenta de informação e acompanhamento, não uma corretora. Não executa ordens de compra ou venda de títulos.",
  ],
  [
    "A invest.ao presta aconselhamento financeiro?",
    "Não. A informação apresentada destina-se ao acompanhamento do mercado e não constitui aconselhamento financeiro nem uma recomendação de investimento.",
  ],
  [
    "Os valores apresentados neste site são actuais?",
    "O painel de preços consulta os dados de mercado usados no dashboard. Cada preço indica o tipo e a data da referência; não é uma garantia de cotação em tempo real. As capturas do iPhone mostram os dados do momento da captura.",
  ],
  [
    "Preciso de instalar a aplicação para usar a invest.ao?",
    "Não. O mercado, a carteira, a lista, os alertas, as comparações e as notícias também estão disponíveis na web. A aplicação para iPhone permite continuar com a mesma conta e receber notificações no dispositivo, se as activares.",
  ],
];

export default function Home() {
  const distribution = appDistribution();
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
            <a href="#aplicacao">Funcionalidades</a>
            <a href="#precos">Preços do mercado</a>
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
              <a href="#aplicacao">Funcionalidades</a>
              <a href="#precos">Preços do mercado</a>
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
                Preços, notícias e os teus investimentos, num só lugar.
                Acompanha o mercado angolano, organiza a carteira e define
                os teus alertas. Aqui no navegador. Também no iPhone.
              </p>
              <div className="opening-actions opening-enter">
                <Link className="solid-button" href="/dashboard">
                  Abrir dashboard <span aria-hidden="true">→</span>
                </Link>
                <a className="quiet-link" href="#aplicacao">
                  Conhecer a invest.ao <span aria-hidden="true">→</span>
                </a>
              </div>
              <p className="opening-platforms opening-enter">
                Consulta o mercado sem conta.
                {distribution.url && (
                  <> <a href="#lancamento">Leva-o também no iPhone <span aria-hidden="true">↗</span></a></>
                )}
              </p>
            </div>
            <aside className="landing-quotes" id="precos" aria-label="Preços de referência do mercado angolano">
              <Suspense fallback={<LandingMarketLoading />}>
                <LandingMarket />
              </Suspense>
            </aside>
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
            <span className="accent-text">Na tua invest.ao.</span>
          </h2>
          <div className="principles">
            <article data-reveal>
              <span className="principle-symbol" aria-hidden="true">
                01
              </span>
              <h3>Conhece os títulos e os emitentes.</h3>
              <p>
                Consulta os títulos do mercado angolano, identifica os emitentes
                e acompanha a evolução dos preços ao longo do tempo.
              </p>
            </article>
            <article data-reveal>
              <span className="principle-symbol" aria-hidden="true">
                02
              </span>
              <h3>Organiza a tua carteira.</h3>
              <p>
                Reúne as tuas posições para acompanhar a composição da carteira
                e consultar o detalhe de cada título.
              </p>
            </article>
            <article data-reveal>
              <span className="principle-symbol" aria-hidden="true">
                03
              </span>
              <h3>Acompanha os teus favoritos.</h3>
              <p>
                Guarda os títulos que queres acompanhar numa lista de favoritos
                e acede à respectiva informação num só lugar.
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
              Tudo disponível na web.
              <br />
              A mesma conta no iPhone.
            </p>
          </div>
          <div className="container landing-features">
            {chapters.map((chapter) => (
              <article className="landing-feature" key={chapter.id} aria-labelledby={chapter.id} data-reveal>
                <p className="eyebrow"><span>{chapter.number}</span> {chapter.label}</p>
                <h3 id={chapter.id}>{chapter.title}</h3>
                <p>{chapter.description}</p>
                <ul>{chapter.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                <Link className="quiet-link" href={chapter.href}>
                  {chapter.action} <span aria-hidden="true">↗</span>
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section
          className="try-section container"
          id="experimentar"
          aria-labelledby="try-title"
        >
          <div className="split-heading" data-reveal>
            <div>
              <p className="eyebrow">O TEU ESPAÇO, NO NAVEGADOR</p>
              <h2 id="try-title">
                Abre o navegador.
                <br />
                <span className="accent-text">Estás no teu mercado.</span>
              </h2>
            </div>
            <p>
              A tua carteira, lista, alertas e simulador também estão na web.
              Entra com a mesma conta e continua de onde ficaste.
            </p>
          </div>
          <div data-reveal>
            <Link className="solid-button" href="/dashboard">
              Abrir dashboard <span aria-hidden="true">→</span>
            </Link>
          </div>
          <nav className="landing-web-links" aria-label="Explorar funcionalidades na web">
            <Link href="/carteira">Carteira ↗</Link>
            <Link href="/lista">Lista ↗</Link>
            <Link href="/alertas">Alertas ↗</Link>
            <Link href="/simular">Simulador ↗</Link>
            <Link href="/noticias">Notícias ↗</Link>
          </nav>
        </section>
        <section
          className="questions-section container"
          id="perguntas"
          aria-labelledby="questions-title"
        >
          <div data-reveal>
            <p className="eyebrow">SOBRE A INVEST.AO</p>
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
        <section className="landing-companion" id="lancamento" aria-labelledby="companion-title">
          <div className="container">
            <div className="landing-companion-heading">
              <div>
                <p className="eyebrow">A MESMA INVEST.AO. MAIS PERTO DE TI.</p>
                <h2 id="companion-title">Leva o mercado<br /><span className="muted-text">contigo.</span></h2>
                <p>A tua lista à mão. Os teus alertas no iPhone. Usa a mesma conta para continuar a acompanhar o que importa, onde estiveres.</p>
                {distribution.url ? (
                  <a className="landing-store-link" href={distribution.url} target="_blank" rel="noopener noreferrer">
                    <Image src="/investao-app-icon.jpg" alt="" width={42} height={42} />
                    <span><small>INVEST.AO PARA IPHONE</small>{distribution.beta ? "Experimentar no TestFlight" : "Descarregar na App Store"}</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                ) : <Link className="quiet-link" href="/dashboard">Continuar no dashboard →</Link>}
                <p className="landing-companion-note">A web continua aqui. A instalação é opcional.</p>
              </div>
              {distribution.url && distribution.qr && (
                <div className="landing-download-qr">
                  <Image src={distribution.qr} alt="Código QR para abrir a página da invest.ao no iPhone" width={116} height={116} unoptimized />
                  <p>Aponta a câmara do iPhone<br />e continua por lá.</p>
                </div>
              )}
            </div>
            <div className="landing-captures" aria-label="Capturas da invest.ao no iPhone">
              {chapters.map((chapter) => (
                <figure key={chapter.id}>
                  <Image src={`/screenshots/2026-10-20/${chapter.image}`} alt={chapter.alt} width={1320} height={2868} sizes="(max-width: 760px) 180px, 240px" />
                  <figcaption>{chapter.caption}</figcaption>
                </figure>
              ))}
            </div>
            <p className="capture-note">Capturas do iPhone. Os valores e as datas pertencem ao momento da captura.</p>
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
