"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useAccount } from "./account-provider";
import Icon from "./invest-icon";

const links = [
  ["/dashboard", "Início", "home"],
  ["/mercado", "Explorar", "markets"],
  ["/carteira", "Carteira", "portfolio"],
  ["/lista", "Lista", "watchlist"],
  ["/pesquisa", "Pesquisa", "search"],
  ["/comparar", "Comparar", "exchange"],
  ["/simular", "Simulador", "calculator"],
  ["/noticias", "Notícias", "news"],
  ["/resumos", "Resumos", "history"],
  ["/agenda", "Agenda", "calendar"],
  ["/alertas", "Alertas", "alert"],
  ["/actividade", "Actividade", "notification"],
];
export default function WorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const { user, privateMode, setPrivateMode } = useAccount();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menu]);
  return (
    <div className="workspace">
      <a className="skip-link" href="#conteudo">
        Saltar para o conteúdo
      </a>
      {menu && (
        <button
          className="menu-backdrop"
          aria-label="Fechar navegação"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`workspace-sidebar ${menu ? "is-open" : ""}`}
      >
        <Link
          className="workspace-brand"
          href="/dashboard"
          aria-label="invest.ao — dashboard"
        >
          <Image src="/investao-app-icon.jpg" width={31} height={31} alt="" />
          <span>
            invest<span>.</span>ao
          </span>
        </Link>
        <p className="nav-label">INVEST.AO</p>
        <nav aria-label="Navegação principal">
          {links.map(([href, label, icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenu(false)}
              aria-current={
                path === href || path.startsWith(`${href}/`)
                  ? "page"
                  : undefined
              }
            >
              <Icon name={icon} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="market-label">
            <i /> BODIVA · Angola
          </span>
          <Link href="/conta" onClick={() => setMenu(false)}>
            {user ? "Perfil e definições" : "Entrar / criar conta"}{" "}
            <span></span>
          </Link>
          <Link href="/">Sobre a invest.ao</Link>
          <Link href="/policy">Privacidade</Link>
        </div>
      </aside>
      <nav className="mobile-tabs" aria-label="Navegação rápida">
        {links.slice(0, 5).map(([href, label, icon]) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMenu(false)}
            aria-current={
              path === href || path.startsWith(`${href}/`)
                ? "page"
                : undefined
            }
          >
            <Icon name={icon} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <button
            className="menu-toggle"
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            aria-controls="workspace-navigation"
            aria-label={menu ? "Fechar navegação" : "Abrir navegação"}
          >
            <Icon name={menu ? "close" : "more"} />
          </button>
          <form action="/pesquisa" className="global-search">
            <Icon name="search" />
            <input
              name="q"
              aria-label="Pesquisar instrumentos e notícias"
              placeholder="Pesquisar instrumentos, emitentes, notícias…"
            />
            <kbd>↵</kbd>
          </form>
          <div className="topbar-actions">
            <button
              disabled={refreshing}
              aria-label="Actualizar dados de mercado"
              title="Actualizar dados de mercado"
              onClick={() => startRefresh(() => router.refresh())}
            >
              <Icon name="refresh" />
            </button>
            <button
              aria-pressed={privateMode}
              onClick={() => setPrivateMode(!privateMode)}
              aria-label={
                privateMode
                  ? "Mostrar valores pessoais"
                  : "Ocultar valores pessoais"
              }
              title="Privacidade"
            >
              <Icon name="lock" />
            </button>
            <Link href="/actividade" aria-label="Actividade e notificações">
              <Icon name="notification" />
            </Link>
            <Link
              className="account-avatar"
              href="/conta"
              aria-label="A minha conta"
            >
              {user ? (
                String(
                  user.user_metadata.investao_display_name ||
                    user.user_metadata.full_name ||
                    user.email ||
                    "EU",
                )
                  .slice(0, 2)
                  .toUpperCase()
              ) : (
                <Icon name="profile" size={18} />
              )}
            </Link>
          </div>
        </header>
        <main id="conteudo" className="workspace-main">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>
            © {new Date().getFullYear()} invest.ao · Feito para Angola.
          </span>
          <span>Informação de mercado. Não executamos operações.</span>
          <a href="mailto:info@invest.ao">Ajuda</a>
        </footer>
      </div>
    </div>
  );
}
