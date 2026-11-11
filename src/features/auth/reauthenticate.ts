"use client";

import { signInHref } from "@/domain/auth/next-path";

import { clearAccountState } from "./account-state";

let leaving = false;

/**
 * The single re-authentication transition: the first caller that learns the session is no longer valid clears
 * the tab's account state and goes to `/entrar`, which says the session ended and returns here afterwards.
 * Later callers in the same tab do nothing, so concurrent failures never stack transitions.
 */
export function reauthenticate(): void {
  if (leaving) return;
  leaving = true;
  clearAccountState();
  window.location.assign(signInHref(`${window.location.pathname}${window.location.search}`, "expired"));
}
