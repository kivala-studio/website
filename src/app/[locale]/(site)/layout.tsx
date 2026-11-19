import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { requestTime } from "@/data/clock";
import { civilDate } from "@/domain/market/zone";
import { SiteFooter, SiteHeader } from "@/features/site/chrome";
import { PageTransition } from "@/ui/motion/page-transition";
import { parseTheme, THEME_COOKIE } from "@/ui/theme/theme";

/** Public site chrome: header, page, footer with the standing disclaimers. From another group, the old frame dissolves into it. */
export default async function SiteLayout({ children }: Readonly<{ children: ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <PageTransition>
      <SiteHeader theme={theme} />
      {children}
      <SiteFooter year={civilDate(requestTime()).slice(0, 4)} />
    </PageTransition>
  );
}
