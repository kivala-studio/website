const siteOrigin = "https://invest.ao";

/** Public discovery only. Personal and plan-limited tools stay in the workspace. */
export function isPublicBrowsePath(value: string): boolean {
  try {
    const url = new URL(value, siteOrigin);
    return (
      url.origin === siteOrigin &&
      (["/", "/pesquisa", "/planos", "/policy", "/cookies"].includes(
        url.pathname,
      ) ||
        /^\/(?:mercado|noticias)(?:\/[^/]+)?\/?$/.test(url.pathname))
    );
  } catch {
    return false;
  }
}
