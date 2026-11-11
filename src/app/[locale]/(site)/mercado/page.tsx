import Decimal from "decimal.js";
import { getLocale, getTranslations } from "next-intl/server";

import { requestTime } from "@/data/clock";
import { getPublicPulse } from "@/data/market/public-cache";
import { type FormatLocale, createFormat } from "@/domain/format";
import type { MarketIndex } from "@/domain/market";
import { civilDate } from "@/domain/market/zone";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { IndexInfo, Movers, SessionFacts, SessionStatus } from "@/features/market/browse/market-overview";
import { siteMetadata } from "@/features/site/metadata";
import { INDEXABLE_PAGES } from "@/features/site/site";
import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { Icon, type IconName } from "@/ui/icons/icon";

export const generateMetadata = siteMetadata({ path: INDEXABLE_PAGES.market, image: "market" }, (t) => ({
  title: t("common.market"),
  description: t("site.meta.marketDescription"),
}));

const tone = (value: Decimal) => (value.gt(0) ? "text-positive bg-positive/10" : value.lt(0) ? "text-negative bg-negative/10" : "text-secondary-text bg-secondary-text/10");

/** The market overview: on its own pane at ≥ 1024 px, below the list on smaller screens. */
export default async function MarketPage() {
  const t = await getTranslations();
  const locale = (await getLocale()) as FormatLocale;
  const format = createFormat(locale, (key, values) => t(key as never, values as never));
  let index: MarketIndex | undefined;
  try {
    index = await getPublicPulse();
  } catch {
    index = undefined;
  }
  const rows = (await catalogueRows(requestTime())) ?? [];
  const links: { href: string; title: string; icon: IconName }[] = [
    { href: INDEXABLE_PAGES.news, title: t("common.news"), icon: "news" },
    { href: INDEXABLE_PAGES.learn, title: t("learn.title"), icon: "document" },
  ];

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="index" className="flex flex-col gap-4">
        <SessionStatus />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <h2 id="index" className="text-secondary font-medium text-secondary-text">
              {t("common.appIndicator")}
            </h2>
            <IndexInfo />
          </div>
          <p className="text-caption text-tertiary-text">{t("widgets.market.calculatedNotOfficial")}</p>
          {index?.value && index.tradingDate !== undefined ? (
            <>
              <p className="mt-2 text-caption text-secondary-text">{t("market.index.closesOn", { arg1: format.civilDate(civilDate(index.tradingDate)) })}</p>
              <p className="flex flex-wrap items-baseline gap-3" data-testid="market-index">
                <span className="text-headline text-primary-text">{format.number(index.value, { digits: 2 })}</span>
                {index.percentageChange ? (
                  <span className={cn("rounded-full px-2 py-1 text-secondary font-semibold", tone(index.percentageChange))}>
                    {format.percent(index.percentageChange)}
                  </span>
                ) : null}
              </p>
            </>
          ) : (
            <p className="mt-2 text-section text-secondary-text">{t("market.index.unavailableTitle")}</p>
          )}
        </div>
        <details className="group rounded-large bg-elevated-background">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-large px-4 text-secondary font-semibold text-primary-text [&::-webkit-details-marker]:hidden">
            {t("markets.details.sessionData")}
            <Icon name="chevron-down" className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="px-4 pt-2 pb-4">
            <SessionFacts />
          </div>
        </details>
      </section>

      <Movers rows={rows} />

      <nav aria-label={t("common.market")} className="flex flex-col gap-3 sm:flex-row">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            prefetch={false}
            className="flex min-h-14 flex-1 items-center gap-3 rounded-large bg-elevated-background px-4 text-secondary font-semibold text-primary-text"
          >
            <Icon name={link.icon} className="text-accent" />
            <span className="flex-1">{link.title}</span>
            <Icon name="chevron-right" className="text-secondary-text" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
