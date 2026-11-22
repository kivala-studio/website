import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { currentAccount } from "@/data/auth/account";
import { requestTime } from "@/data/clock";
import { civilDate } from "@/domain/market/zone";
import { PendingPage } from "@/features/shell/pending-page";
import { parseTheme, THEME_COOKIE } from "@/ui/theme/theme";

import { appHref } from "./app-href";
import { SiteFooter, SiteHeader } from "./chrome";
import { DASHBOARD_PATH } from "./site";

/**
 * A public area layout's frame: the header, the page and the footer. `plus={false}` leaves Plus out of the header and
 * the footer, for the pages the iOS app and the store listings open (App Store rules: no link to the web offer there).
 */
export async function SiteFrame({ plus, children }: { plus: boolean; children: ReactNode }) {
  const [cookieStore, account, locale] = await Promise.all([cookies(), currentAccount(), getLocale()]);
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  return (
    <>
      <SiteHeader theme={theme} plus={plus} dashboard={account ? appHref(DASHBOARD_PATH, locale) : undefined} />
      <PendingPage>{children}</PendingPage>
      <SiteFooter year={civilDate(requestTime()).slice(0, 4)} plus={plus} />
    </>
  );
}
