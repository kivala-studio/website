import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { requestTime } from "@/data/clock";
import { civilDate } from "@/domain/market/zone";
import { PendingPage } from "@/features/shell/pending-page";
import { SiteFooter, SiteHeader } from "@/features/site/chrome";
import { parseTheme, THEME_COOKIE } from "@/ui/theme/theme";

/** Public site chrome: header, page, footer with the standing disclaimers. */
export default async function SiteLayout({ children }: Readonly<{ children: ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <>
      <SiteHeader theme={theme} />
      <PendingPage>{children}</PendingPage>
      <SiteFooter year={civilDate(requestTime()).slice(0, 4)} />
    </>
  );
}
