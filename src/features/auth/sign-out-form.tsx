"use client";

import { useLocale } from "next-intl";
import type { ReactNode } from "react";

import { clearAccountState } from "./account-state";

/**
 * A plain form post to `/auth/sign-out`, which clears the session cookies and the HTTP cache and redirects to
 * `/entrar`. The tab's own account state is cleared first; the full navigation drops everything in memory.
 */
export function SignOutForm({ children, className }: { children: ReactNode; className?: string }) {
  const locale = useLocale();
  return (
    <form method="post" action="/auth/sign-out" onSubmit={clearAccountState} className={className}>
      <input type="hidden" name="locale" value={locale} />
      {children}
    </form>
  );
}
