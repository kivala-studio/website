import type { ReactNode } from "react";

import { MarketArea } from "@/features/market/market-provider";
import { MARKET_PAGE } from "@/features/shell/route-skeletons";
import { AreaMessages } from "@/i18n/area-messages";

/** `/mercado` and its pages share one market store per tab, which adds current quotes in the browser. */
export default function MarketLayout({ children }: { children: ReactNode }) {
  return (
    <AreaMessages area="market">
      <MarketArea>
        <main id="main" className={MARKET_PAGE}>
          {children}
        </main>
      </MarketArea>
    </AreaMessages>
  );
}
