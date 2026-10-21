"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "./account-provider";
import WorkspaceLink from "./workspace-link";
import Icon from "./invest-icon";
import SiteBrand from "./site-brand";

const destinations = [
  ["/mercado", "Mercado"],
  ["/noticias", "Notícias"],
  ["/planos", "Planos"],
];
export default function SiteHeader() {
  const path = usePathname();
  const { user } = useAccount();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  const links = destinations.map(([href, label]) => (
    <Link
      key={href}
      href={href}
      prefetch={false}
      aria-current={
        path === href || path.startsWith(`${href}/`) ? "page" : undefined
      }
    >
      {label}
    </Link>
  ));
  return (
    <header className="public-header">
      <div className="container public-header-inner">
        <Link href="/" aria-label="invest.ao — início">
          <SiteBrand />
        </Link>
        <nav className="browse-nav" aria-label="Navegação principal">
          {links}
        </nav>
        <form action="/pesquisa" role="search" className="browse-search">
          <Icon name="search" size={18} />
          <input
            name="q"
            type="search"
            aria-label="Pesquisar instrumentos, emitentes e notícias"
            placeholder="Instrumento, emitente ou notícia"
            maxLength={100}
            required
          />
          <button type="submit" aria-label="Pesquisar">
            <Icon name="arrow-right" size={17} />
          </button>
        </form>
        <WorkspaceLink className="browse-account" href="/dashboard">
          {user ? "Dashboard" : "Entrar"}
          <Icon name="arrow-up-right" size={16} />
        </WorkspaceLink>
        <details className="browse-mobile-nav" ref={menu}>
          <summary aria-label="Menu de navegação">
            <Icon name="more" size={20} />
          </summary>
          <nav
            aria-label="Navegação móvel"
            onClick={() => {
              if (menu.current) menu.current.open = false;
            }}
          >
            {links}
          </nav>
        </details>
      </div>
    </header>
  );
}
