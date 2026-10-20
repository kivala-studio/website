import { returnPath, signInPath } from "./navigation.ts";

const destinationKey = "investao.auth-return.v1";
const destinationLifetime = 30 * 60 * 1000;
export const authMessages = {
  cancelled: "O início de sessão foi cancelado. Podes tentar novamente com Google ou Apple.",
  expired: "Não foi possível concluir este acesso. A ligação pode ter expirado ou ter sido aberta noutro navegador. Tenta iniciar sessão novamente aqui.",
  unavailable: "Não foi possível confirmar o acesso. Verifica a ligação e tenta novamente.",
} as const;
export type AuthIssue = keyof typeof authMessages;

export function oauthCallbackURL(origin: string) {
  // Keep this exact allowlisted URL stable; the destination belongs to this tab,
  // rather than creating a different OAuth redirect URL for each workspace page.
  return new URL("/auth/callback", origin).href;
}

export function rememberAuthDestination(next: string | null, now = Date.now()) {
  try {
    window.sessionStorage.setItem(destinationKey, JSON.stringify({
      version: 1,
      next: returnPath(next) || "/dashboard",
      expiresAt: now + destinationLifetime,
    }));
  } catch {
    // A blocked storage area cannot authorize a different destination.
    // Authentication can still finish at the default dashboard.
  }
}

export function consumeAuthDestination(legacyNext: string | null, now = Date.now()) {
  let savedNext: string | null = null;
  try {
    const raw = window.sessionStorage.getItem(destinationKey);
    window.sessionStorage.removeItem(destinationKey);
    const saved = JSON.parse(raw || "null");
    if (saved?.version === 1 && Number.isFinite(saved.expiresAt) && saved.expiresAt > now)
      savedNext = returnPath(saved.next);
  } catch {
    // Missing/expired/unreadable destinations fall back to an internal route.
  }
  return returnPath(legacyNext) || savedNext || "/dashboard";
}

export function authIssueMessage(value: string | null) {
  return value && Object.hasOwn(authMessages, value) ? authMessages[value as AuthIssue] : "";
}

export function authCallbackIssue(href: string, error?: { code?: string; details?: { error?: string } } | null): AuthIssue {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const reason = url.searchParams.get("error") || fragment.get("error") || error?.details?.error;
  if (reason === "access_denied") return "cancelled";
  const code = url.searchParams.get("error_code") || fragment.get("error_code") || error?.code;
  if (code && ["flow_state_expired", "flow_state_not_found", "bad_code_verifier", "pkce_code_verifier_not_found", "otp_expired"].includes(code)) return "expired";
  return error ? "unavailable" : "expired";
}

export function failedSignInPath(next: string, issue: AuthIssue) {
  return `${signInPath(next)}&auth_error=${issue}`;
}
