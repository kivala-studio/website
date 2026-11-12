import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { type DeletionResult, accountPageHref } from "@/domain/account/deletion";
import { SIGN_IN_REASONS } from "@/domain/auth/next-path";

import type { RequestSupabase } from "../auth/request-client";
import { DEMO_COOKIES } from "../demo/tiers";

/** The attempt between `/start` and `/complete`: challenge, user and language, five minutes, this host only. */
export const ATTEMPT_COOKIE = "investao-apple-deletion";
export const ATTEMPT_COOKIE_OPTIONS = {
  httpOnly: true,
  // Always: the flow is served over HTTPS, and browsers treat localhost as secure too.
  secure: true,
  sameSite: "lax",
  path: "/api/account/apple-deletion",
  maxAge: 300,
} as const;

const PRIVATE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export const localeOf = (value: FormDataEntryValue | null | undefined): "pt" | "en" => (value === "en" ? "en" : "pt");

function redirect(request: NextRequest, target: string): NextResponse {
  const response = NextResponse.redirect(new URL(target, request.url), 303);
  for (const [name, value] of Object.entries(PRIVATE)) response.headers.set(name, value);
  return response;
}

/** Back to the account page with what happened; the session and local data stay. */
export const backToAccount = (request: NextRequest, locale: string, result: DeletionResult) => redirect(request, accountPageHref(locale, result));

export const toApple = (request: NextRequest, url: string) => redirect(request, url);

export const toHome = (request: NextRequest, locale: string) => redirect(request, locale === "en" ? "/en/inicio" : "/inicio");

/**
 * The account is gone: every cookie that belonged to it expires and the browser drops its cache and storage
 * (`Clear-Site-Data`), then `/entrar` says the account was deleted. Device preferences in cookies (theme,
 * privacy mode, language) stay, as on iOS.
 */
export function accountDeleted(request: NextRequest, locale: string, supabase: RequestSupabase | null): NextResponse {
  const response = redirect(request, `${locale === "en" ? "/en" : ""}/entrar?motivo=${SIGN_IN_REASONS.deleted}`);
  supabase?.clearAll(response);
  for (const name of DEMO_COOKIES) if (request.cookies.has(name)) response.cookies.delete(name);
  response.cookies.set(ATTEMPT_COOKIE, "", { ...ATTEMPT_COOKIE_OPTIONS, maxAge: 0 });
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  response.headers.set("Cache-Control", "no-store");
  return response;
}
