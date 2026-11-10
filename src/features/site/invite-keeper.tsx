"use client";

import { useEffect } from "react";

import { INVITE_STORAGE_KEY } from "./invite-code";

/**
 * Keeps the referral code for redemption after sign-in (W6).
 *
 * sessionStorage rather than a cookie: it is never sent with a request, so the code cannot reach server logs,
 * analytics or third parties, and it needs no consent. It survives the same-tab OAuth round trip of sign-in and
 * is cleared with the tab. If sign-in finishes in another tab, the app's "Tenho um código" entry remains.
 */
export function InviteKeeper({ code }: { code: string }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(INVITE_STORAGE_KEY, code);
    } catch {
      // Storage can be unavailable (private mode, blocked site data); the code stays on screen to type in later.
    }
  }, [code]);
  return null;
}
