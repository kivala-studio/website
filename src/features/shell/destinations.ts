import type { IconName } from "@/ui/icons/icon-pack";

/** Signed-in routes (plan §1.2) plus the search page; every one needs a session. Portuguese slugs in both languages. */
const SIGNED_IN_ROOTS = [
  "inicio",
  "lista",
  "carteira",
  "pesquisa",
  "atividade",
  "atividade-invulgar",
  "semana",
  "simulador",
  "wrap",
  "planos",
  "definicoes",
] as const;

const SIGNED_IN = new RegExp(`^(?:/en)?/(?:${SIGNED_IN_ROOTS.join("|")})(?:/|$)`);

/** Whether a request path (with or without `/en`) needs a session. */
export const isSignedInPath = (pathname: string) => SIGNED_IN.test(pathname);

export type Destination = { href: string; labelKey: string; icon: IconName };

/** The search tab: the phone tab bar has it; from 1024 px the top bar's search field takes its place. */
export const SEARCH_TAB = "/pesquisa";

/** The shell's tabs in iOS order: Início · Explorar · Carteira · Lista · Pesquisa. */
export const TABS: readonly Destination[] = [
  { href: "/inicio", labelKey: "common.home", icon: "home" },
  { href: "/mercado", labelKey: "common.explore", icon: "markets" },
  { href: "/carteira", labelKey: "common.portfolio", icon: "portfolio" },
  { href: "/lista", labelKey: "common.watchlistTab", icon: "watchlist" },
  { href: SEARCH_TAB, labelKey: "common.search", icon: "search" },
];

/** A tab is current on its own page and on the pages below it (`/carteira/posicao/BAI` is Carteira). */
export const isCurrentTab = (href: string, pathname: string) => pathname === href || pathname.startsWith(`${href}/`);
