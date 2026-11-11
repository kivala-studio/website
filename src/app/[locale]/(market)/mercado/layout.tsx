import type { ReactNode } from "react";

import { MarketArea } from "@/features/market/market-provider";
import { PAGE_WIDTH } from "@/features/site/chrome";
import { AreaMessages } from "@/i18n/area-messages";
import { cn } from "@/ui/cn";

/** `/mercado` and its pages share one market store per tab, which adds current quotes in the browser. */
export default function MarketLayout({ children }: { children: ReactNode }) {
  return (
    <AreaMessages area="market">
      <MarketArea>
        <main id="main" className={cn(PAGE_WIDTH, "pt-4 pb-16 lg:pt-6")}>
          {children}
        </main>
      </MarketArea>
    </AreaMessages>
  );
}
