import Link from "next/link";
import { PublicShell, AppInvitation } from "../public-shell";
import { NewsList, DataError } from "../public-content";
import { Consultation } from "../app-prompt";
import { getNews } from "../../lib/public-data";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata({
  title: "Notícias | invest.ao",
  description:
    "Lê as notícias publicadas sobre o mercado angolano, com datas e fontes editoriais.",
  path: "/noticias",
});
export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const raw = (await searchParams).pagina;
  const page =
    raw && /^\d+$/.test(raw) ? Math.min(1000, Math.max(1, Number(raw))) : 1;
  const result = await getNews((page - 1) * 12);
  return (
    <PublicShell>
      <Consultation content="news" />
      <header className="page-heading">
        <p className="eyebrow">EDITORIAL INVEST.AO</p>
        <h1>Notícias.</h1>
        <p>O contexto por trás do mercado.</p>
      </header>
      {result.error ? (
        <DataError content="as notícias" />
      ) : (
        <>
          <NewsList articles={result.data.slice(0, 12)} />
          <nav className="pagination" aria-label="Páginas de notícias">
            {page > 1 ? (
              <Link href={`/noticias?pagina=${page - 1}`}>← Anteriores</Link>
            ) : null}
            <span>Página {page}</span>
            {result.data.length > 12 ? (
              <Link href={`/noticias?pagina=${page + 1}`}>Mais notícias →</Link>
            ) : null}
          </nav>
        </>
      )}
      <AppInvitation position="news-bottom" />
    </PublicShell>
  );
}
