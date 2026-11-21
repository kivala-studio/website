import type { ReactNode } from "react";

import { requireAccount } from "@/data/auth/account";
import { SessionUnavailable, SignedInFrame } from "@/features/shell/signed-in-frame";

/**
 * Signed-in pages. The proxy already sent visitors without a session to `/entrar?next=…`; this check is the
 * verified one (the token's signature), and it also sends an unusable session to sign in once.
 */
export default async function SignedInLayout({ children }: Readonly<{ children: ReactNode }>) {
  const account = await requireAccount();
  return account === "unavailable" ? <SessionUnavailable /> : <SignedInFrame account={account}>{children}</SignedInFrame>;
}
