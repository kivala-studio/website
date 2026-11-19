import type { ReactNode } from "react";

import { requireAccount } from "@/data/auth/account";
import { SessionUnavailable, SignedInFrame } from "@/features/shell/signed-in-frame";
import { PageTransition } from "@/ui/motion/page-transition";

/**
 * Signed-in pages. The proxy already sent visitors without a session to `/entrar?next=…`; this check is the
 * verified one (the token's signature), and it also sends an unusable session to sign in once. Arriving from a page
 * of another group (the market, the site), the old frame dissolves into this one (`PageTransition`).
 */
export default async function SignedInLayout({ children }: Readonly<{ children: ReactNode }>) {
  const account = await requireAccount();
  return <PageTransition>{account === "unavailable" ? <SessionUnavailable /> : <SignedInFrame account={account}>{children}</SignedInFrame>}</PageTransition>;
}
