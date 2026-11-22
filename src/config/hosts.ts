/**
 * The public site and the signed-in app on hosts of their own (`invest.ao` and `dashboard.invest.ao`), when
 * `APP_URL` is set. The site keeps sign-in (its callback is the one on the Supabase allow-list) and every public
 * page; the app has the signed-in pages and, for a signed-in visitor, the market. Session cookies are shared on the
 * parent domain so both hosts see one session.
 */
export type HostSplit = {
  readonly siteOrigin: string;
  readonly appOrigin: string;
  readonly siteHost: string;
  readonly appHost: string;
  /** The site's host when the app is one of its subdomains, so cookies set on it reach both. */
  readonly cookieDomain: string | null;
};

export function hostSplit(siteUrl: string, appUrl: string | null): HostSplit | null {
  if (appUrl === null) return null;
  const site = new URL(siteUrl);
  const app = new URL(appUrl);
  if (site.host === app.host) return null;
  return {
    siteOrigin: site.origin,
    appOrigin: app.origin,
    siteHost: site.host,
    appHost: app.host,
    cookieDomain: app.hostname.endsWith(`.${site.hostname}`) ? site.hostname : null,
  };
}

/** The cookie domain for a request to `hostname`: the shared parent on either host, none elsewhere (previews). */
export function cookieDomainFor(split: HostSplit | null, hostname: string): string | null {
  const domain = split?.cookieDomain;
  return domain && (hostname === domain || hostname.endsWith(`.${domain}`)) ? domain : null;
}

/** The market pages (`/mercado`, `/en/mercado/…`): the app's Explorar tab for a signed-in visitor, public otherwise. */
export const isMarketPath = (pathname: string) => /^(?:\/en)?\/mercado(?:\/|$)/.test(pathname);

/** The app host's root (`/`, `/en`): it opens on Início. */
export const isRootPath = (pathname: string) => /^(?:\/en)?\/?$/.test(pathname);
