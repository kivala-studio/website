/**
 * Route templates of plan §1.2. Analytics and error reports carry the template, never the concrete
 * path, so share tokens, referral codes and symbols visited never leave the browser.
 */
export const ROUTE_TEMPLATES = [
  "/",
  "/policy",
  "/termos",
  "/suporte",
  "/mercado",
  "/mercado/[symbol]",
  "/noticias",
  "/noticias/[slug]",
  "/aprender",
  "/aprender/[lesson]",
  "/partilha/[token]",
  "/convite/[code]",
  "/entrar",
  "/auth/callback",
  "/eliminar-conta",
  "/inicio",
  "/lista",
  "/carteira",
  "/carteira/posicao/[symbol]",
  "/atividade",
  "/atividade-invulgar",
  "/semana",
  "/simulador",
  "/wrap/[period]",
  "/planos",
  "/definicoes",
] as const;

export type RouteTemplate = (typeof ROUTE_TEMPLATES)[number] | typeof NOT_FOUND_TEMPLATE;
export const NOT_FOUND_TEMPLATE = "/_not-found";

const DEFAULT_LOCALE = "pt";

const segments = (path: string) => path.split("/").filter(Boolean);
const PATTERNS = ROUTE_TEMPLATES.map((template) => ({ template, parts: segments(template) }));

export const isRouteTemplate = (value: unknown): value is RouteTemplate =>
  value === NOT_FOUND_TEMPLATE || (ROUTE_TEMPLATES as readonly unknown[]).includes(value);

/** `/en/partilha/abc?x=1#y` → `{ template: "/partilha/[token]", locale: "en" }`. Unknown paths are not-found. */
export function routeTemplate(url: string): { template: RouteTemplate; locale: "pt" | "en" } {
  let path = url;
  try {
    path = new URL(url, "https://invalid").pathname;
  } catch {
    path = "/";
  }
  const parts = segments(path);
  const locale = parts[0] === "en" ? "en" : DEFAULT_LOCALE;
  if (parts[0] === "en" || parts[0] === "pt") parts.shift();
  const match = PATTERNS.find(
    (pattern) =>
      pattern.parts.length === parts.length &&
      pattern.parts.every((part, index) => (part.startsWith("[") ? parts[index] !== "" : part === parts[index])),
  );
  return { template: match?.template ?? NOT_FOUND_TEMPLATE, locale };
}
