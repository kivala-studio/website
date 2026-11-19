import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { currentAccount } from "@/data/auth/account";
import { requestTime } from "@/data/clock";
import { civilDate } from "@/domain/market/zone";
import { SiteFooter, SiteHeader } from "@/features/site/chrome";
import { SignedInFrame } from "@/features/shell/signed-in-frame";
import { PageTransition } from "@/ui/motion/page-transition";
import { parseTheme, THEME_COOKIE } from "@/ui/theme/theme";

/**
 * The public market (`/mercado`, `/mercado/[symbol]`) is one set of pages for everyone: visitors get the site
 * chrome, signed-in visitors the app shell, where it is the Explorar tab. Arriving from a page of another group, the
 * old frame dissolves into this one (`PageTransition`).
 */
export default async function MarketAreaLayout({ children }: Readonly<{ children: ReactNode }>) {
  const account = await currentAccount();
  if (account) {
    return (
      <PageTransition>
        <SignedInFrame account={account}>{children}</SignedInFrame>
      </PageTransition>
    );
  }
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <PageTransition>
      <SiteHeader theme={theme} />
      {children}
      <SiteFooter year={civilDate(requestTime()).slice(0, 4)} />
    </PageTransition>
  );
}
