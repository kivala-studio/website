/** Where a signed-in visitor lands when there is no usable `next`. */
export const DEFAULT_SIGNED_IN_PATH = "/inicio";

/** Paths that must never be a post-sign-in destination: they would loop or restart the flow. */
const SIGN_IN_FLOW = /^\/(?:en\/)?(?:entrar|auth)(?:[/?#]|$)/;
const LOCAL_ORIGIN = "http://next.invalid";
const MAX_LENGTH = 2048;

/**
 * The same-origin path a sign-in may return to, or `fallback`.
 *
 * Accepted: an absolute path (`/carteira?x=1#y`). Rejected: absolute and protocol-relative URLs, backslash
 * tricks (`/\evil`), control characters, the sign-in flow itself and anything that resolves to another origin.
 * The result is the normalised path, so `/a/../carteira` comes back as `/carteira`.
 */
export function safeNextPath(raw: string | null | undefined, fallback: string = DEFAULT_SIGNED_IN_PATH): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return fallback;
  // Browsers treat `\` as `/` and drop tabs and newlines, so `/\evil.com` and `/\t/evil.com` leave the origin.
  if (!raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  let url: URL;
  try {
    url = new URL(raw, LOCAL_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== LOCAL_ORIGIN) return fallback;
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (path.startsWith("//") || SIGN_IN_FLOW.test(path)) return fallback;
  return path;
}

/** The locale a same-origin path belongs to (`/en/…` is English, everything else Portuguese). */
export const localeOfPath = (path: string): "pt" | "en" => (/^\/en(?:[/?#]|$)/.test(path) ? "en" : "pt");

/** Why the sign-in page was opened, carried as `?motivo=` (Portuguese values in both languages). */
export const SIGN_IN_REASONS = { expired: "sessao", failed: "falha", signedOutHere: "local" } as const;
export type SignInReason = keyof typeof SIGN_IN_REASONS;

export function readSignInReason(value: string | null | undefined): SignInReason | null {
  const entry = Object.entries(SIGN_IN_REASONS).find(([, slug]) => slug === value);
  return entry ? (entry[0] as SignInReason) : null;
}

/** `/entrar` (or `/en/entrar`) carrying the destination and, when there is one, the reason. */
export function signInHref(next: string, reason?: SignInReason): string {
  const destination = safeNextPath(next);
  const prefix = localeOfPath(destination) === "en" ? "/en" : "";
  const params = new URLSearchParams();
  if (destination !== DEFAULT_SIGNED_IN_PATH) params.set("next", destination);
  if (reason) params.set("motivo", SIGN_IN_REASONS[reason]);
  const query = params.toString();
  return `${prefix}/entrar${query ? `?${query}` : ""}`;
}
