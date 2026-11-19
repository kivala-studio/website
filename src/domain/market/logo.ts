/*
 * Issuer logos. Browsers load them from the site's own origin (`/api/logos/{issuer}`); the route resolves
 * the source from the issuer row and fetches it on the server, so the CSP stays closed to third-party images.
 */

const ISSUER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Issuer ids are UUIDs; anything else never reaches the database. */
export const isIssuerID = (value: string): boolean => ISSUER_ID.test(value);

/** The same-origin logo path for an issuer, or `undefined` without a well-formed issuer id. */
export function issuerLogoPath(issuerID: string | undefined): string | undefined {
  return issuerID && isIssuerID(issuerID) ? `/api/logos/${issuerID.toLowerCase()}` : undefined;
}

/** The logo source for an issuer row (iOS `SecurityLogoCache`): the curated logo, else the website's favicon. */
export function resolvedLogoURL(issuer: { readonly logoURL?: string; readonly websiteURL?: string }): string | undefined {
  if (issuer.logoURL) return issuer.logoURL;
  if (!issuer.websiteURL) return undefined;
  const url = new URL("https://www.google.com/s2/favicons");
  url.searchParams.set("domain_url", issuer.websiteURL);
  url.searchParams.set("sz", "128");
  return url.toString();
}

/** Raster types the logo route passes on; SVG and everything else is refused. */
const LOGO_TYPES: Readonly<Record<string, string>> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
  "image/x-icon": "image/x-icon",
  "image/vnd.microsoft.icon": "image/x-icon",
};

/** The normalised raster type of a `Content-Type` header, or `undefined` when it is not an accepted logo. */
export function logoImageType(contentType: string | null | undefined): string | undefined {
  const type = contentType?.split(";")[0]?.trim().toLowerCase();
  return type ? LOGO_TYPES[type] : undefined;
}
