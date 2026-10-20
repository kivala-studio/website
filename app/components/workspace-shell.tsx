"use client";
import Link from "next/link";
import AppMark from "./app-mark";
import AppearanceSelect from "./appearance-select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useAccount } from "./account-provider";
import Icon from "./invest-icon";
import { returnPath, signInPath } from "../../lib/navigation";

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
export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const router = useRouter();
  const { user, loading } = useAccount();
  const entry = path === "/auth/callback" || (path === "/conta" && ["verified", "invalid"].includes(params.get("appleDeletion") || ""));
  const next = path === "/conta"
    ? returnPath(params.get("next")) || "/dashboard"
    : returnPath(`${path}${query ? `?${query}` : ""}`) || "/dashboard";
  const login = signInPath(next);

  useEffect(() => {
    if (!entry && !loading && !user) router.replace(login);
  }, [entry, loading, user, login, router]);

  if (entry) {
    return <AccessShell>{children}</AccessShell>;
  }
  // The verified browser session must resolve before any workspace UI mounts.
  // Personal data still uses authenticated requests and the existing ownership policies.
  if (!user) {
    return (
      <AccessShell>
        <section className="access-status" role="status">
          <p className="eyebrow">A TUA INVEST.AO</p>
          <h1>{loading ? "A recuperar a tua sessão…" : "Entra para continuar."}</h1>
          <p>{loading ? "A confirmar o acesso à tua conta." : "A abrir o início de sessão…"}</p>
          {!loading && <Link className="primary-button" href={login}>Entrar ou criar conta</Link>}
        </section>
      </AccessShell>
    );
  }
  return <WorkspaceFrame key={user.id}>{children}</WorkspaceFrame>;
}

function AccessShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="workspace access-shell">
      <header className="access-header">
        <Link className="workspace-brand" href="/" aria-label="invest.ao — início">
          <AppMark size={36} /><span>invest<span>.</span>ao</span>
        </Link>
        <AppearanceSelect />
        <Link className="access-back" href="/">Voltar ao site</Link>
      </header>
      <main className="access-main" id="conteudo">{children}</main>
    </div>
  );
}

function WorkspaceFrame({
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
          prefetch={false}
          aria-label="invest.ao — dashboard"
        >
          <AppMark size={31} />
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
              prefetch={false}
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
          <AppearanceSelect />
          <span className="market-label">
            <i /> BODIVA · Angola
          </span>
          <Link href="/conta" prefetch={false} onClick={() => setMenu(false)}>
            {user ? "Perfil e definições" : "Entrar / criar conta"}{" "}
            <span></span>
          </Link>
          <Link href="/">Sobre a invest.ao</Link>
          <Link href="/policy">Privacidade</Link>
          <Link href="/cookies">Cookies</Link>
        </div>
      </aside>
      <nav className="mobile-tabs" aria-label="Navegação rápida">
        {links.slice(0, 5).map(([href, label, icon]) => (
          <Link
            key={href}
            href={href}
            prefetch={false}
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
              <Icon name={privateMode ? "lock" : "unlock"} />
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
