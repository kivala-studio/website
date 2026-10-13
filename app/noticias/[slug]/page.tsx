/* Editorial images have arbitrary public hosts and load lazily without a proxy. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { PublicShell, AppInvitation } from "../../public-shell";
import { DataError } from "../../public-content";
import { Consultation } from "../../app-prompt";
import { getArticle } from "../../../lib/public-data";
import { date } from "../../../lib/market-presentation";
import { pageMetadata } from "../../../lib/seo";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const result = await getArticle(slug);
  return pageMetadata({
    title: result.data
      ? `${result.data.title} | invest.ao`
      : "Notícia | invest.ao",
    description:
      result.data?.summary ||
      "Leitura pública de notícias do mercado angolano.",
    path: `/noticias/${encodeURIComponent(slug)}`,
  });
}
export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const result = await getArticle(slug);
  if (result.error)
    return (
      <PublicShell>
        <DataError content="a notícia" />
      </PublicShell>
    );
  const a = result.data;
  if (!a) notFound();
  return (
    <PublicShell>
      <Consultation content="article" />
      <Link className="back-link" href="/noticias">
        ← Notícias
      </Link>
      <article className="article-reading">
        <header className="page-heading">
          <p className="eyebrow">
            EDITORIAL INVEST.AO ·{" "}
            <time dateTime={a.published_at}>
              {date(a.published_at, true)} · Luanda
            </time>
          </p>
          <h1>{a.title}</h1>
          <p>{a.summary}</p>
        </header>
        <div className="prose">
          <Markdown
            skipHtml
            components={{
              img: ({ alt, src }) =>
                src && /^https:\/\//i.test(String(src)) ? (
                  <figure>
                    <img
                      src={src}
                      alt={alt || "Imagem editorial"}
                      loading="lazy"
                    />
                  </figure>
                ) : null,
            }}
          >
            {a.body_markdown || ""}
          </Markdown>
        </div>
        {a.news_article_sources.length ? (
          <section className="article-sources">
            <h2>Fontes</h2>
            <ul>
              {a.news_article_sources.map((source, i) =>
                /^https?:\/\//i.test(source.source_url) ? (
                  <li key={i}>
                    <a
                      href={source.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.source_title ||
                        source.news_sources?.name ||
                        "Consultar fonte"}{" "}
                      ↗
                    </a>
                  </li>
                ) : null,
              )}
            </ul>
          </section>
        ) : null}
        {a.news_article_securities.length ? (
          <section className="related-instruments">
            <h2>Instrumentos desta notícia</h2>
            {a.news_article_securities.map(({ securities: s }) => (
              <Link key={s.id} href={`/mercado/${s.id}`}>
                {s.symbol} →
              </Link>
            ))}
          </section>
        ) : null}
      </article>
      <AppInvitation
        feature={a.news_article_securities.length ? "watchlist" : "discover"}
        position="article-end"
      />
    </PublicShell>
  );
}
