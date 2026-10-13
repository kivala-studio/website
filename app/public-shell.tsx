import Image from "next/image";
import Link from "next/link";
import AppPrompt from "./app-prompt";
import { appDistribution } from "../lib/app-distribution";
export function Brand() {
  return (
    <span className="brand">
      <Image src="/investao-logo.svg" width={32} height={32} alt="" />
      <span>
        invest<span className="brand-dot">.</span>ao
      </span>
    </span>
  );
}
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Saltar para o conteúdo
      </a>
      <header className="site-header container">
        <Link href="/" aria-label="invest.ao — início">
          <Brand />
        </Link>
        <nav aria-label="Navegação principal">
          <Link href="/">Início</Link>
          <Link href="/mercado">Mercado</Link>
          <Link href="/noticias">Notícias</Link>
          <Link href="/#aplicacao">App iOS</Link>
        </nav>
      </header>
      <main id="conteudo" className="container public-main">
        {children}
      </main>
      <footer className="container">
        <div className="footer-top">
          <Link href="/" aria-label="invest.ao — início">
            <Brand />
          </Link>
          <span>Descobre aqui. Acompanha no iPhone.</span>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} invest.ao</span>
          <Link href="/policy">Privacidade</Link>
          <a href="mailto:info@invest.ao">Suporte e contacto</a>
          <p>
            Informação de mercado. Não executamos operações nem prestamos
            aconselhamento financeiro.
          </p>
        </div>
      </footer>
    </>
  );
}
export function AppInvitation({
  feature = "discover",
  position,
  compact = false,
}: {
  feature?: "discover" | "watchlist" | "alerts" | "compare" | "portfolio";
  position: string;
  compact?: boolean;
}) {
  return (
    <aside
      className={compact ? "app-invitation compact" : "app-invitation"}
      aria-label="Continua no app iOS"
    >
      <div>
        <p className="eyebrow">NO APP IOS</p>
        <h2>
          {feature === "watchlist"
            ? "Guarda os instrumentos que te interessam."
            : feature === "alerts"
              ? "Acompanha sem voltar a procurar."
              : "Descobre aqui. Acompanha no app."}
        </h2>
        <p>Favoritos, alertas de preço e carteira no teu iPhone.</p>
      </div>
      <AppPrompt feature={feature} position={position} {...appDistribution()} />
    </aside>
  );
}
