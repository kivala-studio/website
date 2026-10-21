"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SiteBrand from "./components/site-brand";
import SiteHeader from "./components/site-header";
import WorkspaceLink from "./components/workspace-link";
import { CookiePreferencesButton } from "./components/cookie-consent";
import { isPublicBrowsePath } from "../lib/public-routes";
import WorkspaceShell from "./components/workspace-shell";
export function Brand() {
  return <SiteBrand />;
}
export function PublicShell({
  children,
  publicPage = false,
}: {
  children: React.ReactNode;
  publicPage?: boolean;
}) {
  const path = usePathname();
  if (!publicPage && !isPublicBrowsePath(path))
    return <WorkspaceShell>{children}</WorkspaceShell>;
  return (
    <div className="browse-page">
      <a className="skip-link" href="#conteudo">
        Saltar para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo" className="container browse-main">
        {children}
      </main>
      <footer className="container browse-footer">
        <div className="browse-footer-top">
          <Link href="/" aria-label="invest.ao — início">
            <SiteBrand />
          </Link>
          <nav aria-label="Informação do site">
            <Link href="/planos">Planos</Link>
            <Link href="/policy">Privacidade</Link>
            <Link href="/cookies">Cookies</Link>
            <CookiePreferencesButton />
            <a href="mailto:info@invest.ao">Contacto</a>
          </nav>
        </div>
        <p>
          © {new Date().getFullYear()} invest.ao · Informação de mercado. Não
          executamos operações nem prestamos aconselhamento financeiro.
        </p>
      </footer>
    </div>
  );
}
export function FeatureInvitation({
  feature = "discover",
  compact = false,
}: {
  feature?: "discover" | "watchlist" | "alerts" | "compare" | "portfolio";
  position: string;
  compact?: boolean;
}) {
  const content = {
    discover: [
      "O teu mercado começa aqui.",
      "Entra na tua conta para acompanhar os teus investimentos.",
      "A minha conta",
      "/conta",
    ],
    watchlist: [
      "Fica a acompanhar.",
      "Guarda os instrumentos que queres seguir e recebe os seus movimentos.",
      "A minha lista",
      "/lista",
    ],
    alerts: [
      "Escolhe o que merece a tua atenção.",
      "Define um preço ou uma variação para os instrumentos que acompanhas.",
      "Gerir alertas",
      "/alertas",
    ],
    compare: [
      "Põe o percurso em perspectiva.",
      "Compara dois instrumentos no mesmo período.",
      "Comparar instrumentos",
      "/comparar",
    ],
    portfolio: [
      "Os teus investimentos, com contexto.",
      "Regista as tuas operações e acompanha as posições.",
      "A minha carteira",
      "/carteira",
    ],
  }[feature];
  return (
    <aside className={`web-invitation ${compact ? "compact" : ""}`}>
      <div>
        <h2>{content[0]}</h2>
        <p>{content[1]}</p>
      </div>
      <WorkspaceLink className="secondary-button" href={content[3]}>
        {content[2]}
      </WorkspaceLink>
    </aside>
  );
}
