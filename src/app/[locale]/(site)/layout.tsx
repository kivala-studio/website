import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { currentAccount } from "@/data/auth/account";
import { requestTime } from "@/data/clock";
import { civilDate } from "@/domain/market/zone";
import { PendingPage } from "@/features/shell/pending-page";
import { appHref } from "@/features/site/app-href";
import { SiteFooter, SiteHeader } from "@/features/site/chrome";
import { DASHBOARD_PATH } from "@/features/site/site";
import { parseTheme, THEME_COOKIE } from "@/ui/theme/theme";

/** Public site chrome: header, page, footer with the standing disclaimers. */
export default async function SiteLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [cookieStore, account, locale] = await Promise.all([cookies(), currentAccount(), getLocale()]);
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  return (
    <>
      <SiteHeader theme={theme} dashboard={account ? appHref(DASHBOARD_PATH, locale) : undefined} />
      <PendingPage>{children}</PendingPage>
      <SiteFooter year={civilDate(requestTime()).slice(0, 4)} />
    </>
  );
}
