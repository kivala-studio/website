import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { currentAccount } from "@/data/auth/account";
import { SiteFooter, SiteHeader } from "@/features/site/chrome";
import { SignedInFrame } from "@/features/shell/signed-in-frame";
import { parseTheme, THEME_COOKIE } from "@/ui/theme/theme";

/**
 * The public market (`/mercado`, `/mercado/[symbol]`) is one set of pages for everyone: visitors get the site
 * chrome, signed-in visitors the app shell, where it is the Explorar tab.
 */
export default async function MarketAreaLayout({ children }: Readonly<{ children: ReactNode }>) {
  const account = await currentAccount();
  if (account) return <SignedInFrame account={account}>{children}</SignedInFrame>;
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter theme={theme} />
    </>
  );
}
