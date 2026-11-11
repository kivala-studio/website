import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { requestTime } from "@/data/clock";
import { ErrorPresenter } from "@/features/errors/error-presenter";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { MarketBrowser } from "@/features/market/browse/market-browser";
import { MarketProvider } from "@/features/market/market-provider";
import { PAGE_WIDTH } from "@/features/site/chrome";
import { AreaMessages } from "@/i18n/area-messages";
import { cn } from "@/ui/cn";
import { ToastHost } from "@/ui/components/feedback";
import { ErrorState } from "@/ui/components/states";

/**
 * `/mercado` and `/mercado/[symbol]` share the market list: beside the page at ≥ 1024 px (master–detail),
 * and on its own on `/mercado` below that. One market store per tab adds current quotes in the browser.
 */
export default async function MarketLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  const now = requestTime();
  const rows = await catalogueRows(now);
  return (
    <AreaMessages area="market">
      <ToastHost>
        <MarketProvider>
          <ErrorPresenter />
          <main id="main" className={cn(PAGE_WIDTH, "grid gap-10 pt-4 pb-16 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-12")}>
            <div className="max-lg:has-[[data-selected]]:hidden lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto lg:px-1">
              {rows ? <MarketBrowser rows={rows} renderedAt={now} /> : <ErrorState message={t("components.placeholder.loadFailed")} />}
            </div>
            <div className="min-w-0">{children}</div>
          </main>
        </MarketProvider>
      </ToastHost>
    </AreaMessages>
  );
}
