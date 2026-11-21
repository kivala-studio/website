import { getLocale, getTranslations } from "next-intl/server";

import { currentAccount } from "@/data/auth/account";
import { requestTime } from "@/data/clock";
import { getPublicPulse } from "@/data/market/public-cache";
import { type FormatLocale, createFormat } from "@/domain/format";
import type { MarketIndex } from "@/domain/market";
import { civilDate } from "@/domain/market/zone";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { MarketBrowser, type MarketBrowserLink } from "@/features/market/browse/market-browser";
import { IndexInfo, MarketMovers, SessionFacts, SessionStatusTile } from "@/features/market/browse/market-overview";
import { MarketInformationSummary } from "@/features/news/market-information";
import { siteMetadata } from "@/features/site/metadata";
import { INDEXABLE_PAGES } from "@/features/site/site";
import { ChangeBadge } from "@/ui/components/financial";
import { Card, StatTile } from "@/ui/components/layout";
import { ErrorState } from "@/ui/components/states";

export const generateMetadata = siteMetadata({ path: INDEXABLE_PAGES.market, image: "market" }, (t) => ({
  title: t("common.market"),
  description: t("site.meta.marketDescription"),
}));

/**
 * The market overview (the CoinStats list layout): a centred title, three summary cards (market status with the
 * Indicador invest.ao, session data, movers), the category tabs with search and sort, then the table. The server
 * renders dated verified closes; current quotes, the session figures and the movers arrive in the browser.
 */
export default async function MarketPage() {
  const now = requestTime();
  const [t, locale, index, catalogue, account] = await Promise.all([
    getTranslations(),
    getLocale() as Promise<FormatLocale>,
    getPublicPulse(now).catch((): MarketIndex | undefined => undefined),
    catalogueRows(now),
    currentAccount(),
  ]);
  const format = createFormat(locale, (key, values) => t(key as never, values as never));
  // Visitors reach Notícias and Aprender from the top bar; the app shell has no such links, so the tab row carries them.
  const links: MarketBrowserLink[] = account
    ? [
        { href: INDEXABLE_PAGES.news, title: t("common.news") },
        { href: INDEXABLE_PAGES.learn, title: t("learn.title") },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <h1 className="pt-2 text-center text-display text-primary-text lg:pt-4">{t("common.market")}</h1>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title={t("settings.marketData.status")} titleId="market-status-title" className="flex flex-col" bodyClassName="flex-1">
          <dl className="grid h-full grid-rows-[auto_1fr] gap-3">
            <StatTile
              size="large"
              label={
                <>
                  {t("common.appIndicator")}
                  <IndexInfo />
                </>
              }
              value={
                index?.value && index.tradingDate !== undefined ? (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="market-index">
                    {format.number(index.value, { digits: 2 })}
                    {index.percentageChange ? <ChangeBadge value={index.percentageChange.toString()} /> : null}
                  </span>
                ) : (
                  <span className="text-body font-medium text-secondary-text">{t("market.index.unavailableTitle")}</span>
                )
              }
              detail={
                <>
                  {index?.value && index.tradingDate !== undefined ? (
                    <span className="block">{t("market.index.closesOn", { arg1: format.civilDate(civilDate(index.tradingDate)) })}</span>
                  ) : null}
                  <span className="block">{t("widgets.market.calculatedNotOfficial")}</span>
                </>
              }
            />
            <SessionStatusTile />
          </dl>
        </Card>

        <Card title={t("markets.details.sessionData")} titleId="session-data-title" className="flex flex-col" bodyClassName="flex-1">
          <SessionFacts />
        </Card>

        <div className="md:col-span-2 xl:col-span-1">
          <MarketMovers rows={catalogue ?? []} />
        </div>
      </div>

      <MarketInformationSummary />

      {catalogue ? <MarketBrowser rows={catalogue} renderedAt={now} links={links} /> : <ErrorState message={t("components.placeholder.loadFailed")} />}
    </div>
  );
}
