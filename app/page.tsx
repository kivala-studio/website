import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { PublicShell, AppInvitation } from "./public-shell";
import { MarketContent, RecentNews, LoadingContent } from "./public-content";
import AppPrompt from "./app-prompt";
import { appDistribution } from "../lib/app-distribution";
import { SiteSchema } from "./site-schema";
import { pageMetadata, siteDescription, siteTitle } from "../lib/seo";
export const metadata = pageMetadata({
  title: siteTitle,
  description: siteDescription,
  path: "/",
});
export default function Home() {
  return (
    <PublicShell>
      <SiteSchema />
      <section className="home-opening">
        <p className="eyebrow">MERCADO DE CAPITAIS · ANGOLA</p>
        <h1>
          Descobre o mercado.
          <br />
          <span className="accent-text">Acompanha o que importa.</span>
        </h1>
        <div className="hero-summary" id="perspectiva">
          <p>
            Consulta cotações e notícias do mercado angolano. No app para
            iPhone, acompanha os instrumentos que te interessam.
          </p>
          <AppPrompt
            feature="discover"
            position="hero"
            {...appDistribution()}
          />
        </div>
      </section>
      <section id="experimentar" className="public-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">CONSULTA PÚBLICA</p>
            <h2 id="visao-do-mercado">O mercado, à vista.</h2>
          </div>
          <Link href="/mercado">Ver instrumentos →</Link>
        </div>
        <Suspense fallback={<LoadingContent />}>
          <MarketContent preview />
        </Suspense>
      </section>
      <section className="public-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">INFORMAÇÃO PUBLICADA</p>
            <h2>Notícias do mercado.</h2>
          </div>
          <Link href="/noticias">Todas as notícias →</Link>
        </div>
        <Suspense fallback={<LoadingContent />}>
          <RecentNews />
        </Suspense>
      </section>
      <section id="aplicacao" className="public-section app-story">
        <div>
          <p className="eyebrow">CONTINUA NO IPHONE</p>
          <h2>
            Do que descobres
            <br />
            ao que acompanhas.
          </h2>
          <p>
            O site dá-te uma visão do mercado. O app reúne os teus favoritos, os
            alertas que configuras e as posições que registas.
          </p>
          <div className="app-features">
            <div>
              <h3>Os teus instrumentos</h3>
              <p>Guarda favoritos numa lista de acompanhamento.</p>
              <AppPrompt
                feature="watchlist"
                position="benefits"
                {...appDistribution()}
              />
            </div>
            <div id="comparar-titulos">
              <h3 id="detalhe-do-titulo">Mais contexto</h3>
              <p>Consulta o histórico e compara a evolução de instrumentos.</p>
              <AppPrompt
                feature="compare"
                position="benefits"
                {...appDistribution()}
              />
            </div>
            <div>
              <h3>A tua carteira</h3>
              <p>Regista posições e acompanha a sua composição.</p>
              <AppPrompt
                feature="portfolio"
                position="benefits"
                {...appDistribution()}
              />
            </div>
          </div>
        </div>
        <figure className="app-capture">
          <Image
            src="/screenshots/asset-comparison.png"
            width={402}
            height={874}
            alt="Captura do app iOS a comparar dois instrumentos por desempenho"
            sizes="(max-width: 760px) 240px, 280px"
          />
          <figcaption>
            Captura do app iOS. Valores e datas do momento da captura.
          </figcaption>
        </figure>
      </section>
      <section id="perguntas" className="public-section faq">
        <h2>Antes de continuar.</h2>
        <details>
          <summary>Posso comprar ou vender aqui?</summary>
          <p>
            O invest.ao é uma ferramenta de informação e acompanhamento. Não
            executa ordens de compra ou venda e não presta aconselhamento
            financeiro.
          </p>
        </details>
        <details>
          <summary>Os preços são em tempo real?</summary>
          <p>
            Apresentamos os dados disponíveis nas fontes existentes, com a data
            e o tipo de referência. Confirma a actualidade em cada instrumento.
          </p>
        </details>
        <details>
          <summary>Como obtenho o app?</summary>
          <p>
            {appDistribution().url
              ? "Usa o convite para aceder à distribuição oficial para iPhone. No desktop, podes ler o QR code com a câmara do iPhone."
              : "O destino oficial para iPhone ainda não foi confirmado neste site."}{" "}
            A consulta pública não exige instalação.
          </p>
        </details>
      </section>
      <section id="lancamento">
        <AppInvitation position="closing" />
      </section>
    </PublicShell>
  );
}
