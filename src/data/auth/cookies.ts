import type { CookieOptions } from "@supabase/ssr";

/** Session cookies (`sb-<ref>-auth-token`, chunked as `.0`, `.1`…), not the PKCE verifier. */
const SESSION_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;
/** Every cookie the Supabase client writes, including the PKCE verifier. */
const SUPABASE_COOKIE = /^sb-/;

export const isSessionCookie = (name: string) => SESSION_COOKIE.test(name);
export const isSupabaseCookie = (name: string) => SUPABASE_COOKIE.test(name);
export const hasSessionCookie = (cookies: readonly { name: string }[]) => cookies.some(({ name }) => isSessionCookie(name));

/**
 * Session cookies are set and read only by the server: `HttpOnly` keeps tokens away from page scripts,
 * `SameSite=Lax` keeps them off cross-site subrequests and form posts, and `Secure` applies on HTTPS (plain-HTTP
 * localhost would otherwise drop them in some engines).
 */
export const sessionCookieOptions = (secure: boolean): CookieOptions => ({ path: "/", sameSite: "lax", httpOnly: true, secure });

/** Where `/auth/sign-in` keeps the post-sign-in path for `/auth/callback` (the redirect URL stays exact for the allow-list). */
export const NEXT_PATH_COOKIE = "investao-next";
export const nextPathCookieOptions = (secure: boolean): CookieOptions => ({
  path: "/auth/callback",
  sameSite: "lax",
  httpOnly: true,
  secure,
  maxAge: 600,
});

/** Signed-in responses and every response that sets or clears a session. */
export const PRIVATE_NO_STORE = "private, no-store";
