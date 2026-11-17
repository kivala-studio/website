import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { requestTime } from "@/data/clock";
import { MARKET_CATEGORY_LABEL_KEYS, type MarketCategory } from "@/domain/market";
import { MARKET_DEFAULT_QUERY, marketQueryParams } from "@/features/market/browse/query";
import alerts from "@/features/site/assets/alerts.webp";
import comparison from "@/features/site/assets/comparison.webp";
import instrument from "@/features/site/assets/instrument.webp";
import { PalancaMark } from "@/features/site/chrome";
import { ENTRY_TILE_ITEM, EntryTile, FactItem, FeatureRow, HOME_HEADING, HOME_SECTION, HeroRings, HubDiagram } from "@/features/site/home";
import { HeroSearch, MarketPreview } from "@/features/site/home-client";
import { HOME_CATEGORIES, type HomeCategory, homeMarket } from "@/features/site/home-market";
import { pageMetadata } from "@/features/site/metadata";
import { INDEXABLE_PAGES, SIGN_IN_PATH } from "@/features/site/site";
import { OrganizationData } from "@/features/site/structured-data";
import { PhoneFigure, PortfolioIllustration, Screenshot, StoreButton } from "@/features/site/visuals";
import { getPathname } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { ButtonLink } from "@/ui/components/buttons";
import { PAGE_CONTAINER } from "@/ui/components/layout";
import { Icon, type IconName } from "@/ui/icons/icon";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "site.meta" });
  return pageMetadata({
    locale,
    path: "/",
    title: t("homeTitle"),
    description: t("homeDescription"),
    image: "home",
    absoluteTitle: true,
  });
}

const KIND_ICON: Record<HomeCategory, IconName> = { equities: "trend-up", bonds: "bond", funds: "dividend", treasury: "shield-check" };

/** `/mercado` filtered to one kind (the canonical `/mercado` for the default kind). */
const marketHref = (category: MarketCategory) => ({
  pathname: INDEXABLE_PAGES.market,
  query: marketQueryParams({ ...MARKET_DEFAULT_QUERY, category }),
});

/**
 * The landing page, in the CoinStats landing order: hero with entry tiles, search and actions; a market preview;
 * the product in one view; three feature rows; Plus; a closing band. Market rows are the cached catalogue's dated
 * verified closes, the same server path as `/mercado`.
 */
export default async function HomePage() {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const translate = (key: string) => t(key as never);
  const market = await homeMarket(requestTime());
  const categories = market?.categories.map(({ category }) => category) ?? HOME_CATEGORIES;
  const signIn = t("onboarding.navigation.signIn");

  return (
    <main id="main">
      <OrganizationData />

      <section className="relative isolate overflow-hidden">
        <HeroRings />
        <div className={cn(PAGE_CONTAINER, "flex flex-col items-center gap-8 pt-12 pb-16 text-center md:pt-20 md:pb-20")}>
          <div className="flex max-w-3xl flex-col items-center gap-4">
            <h1 className="text-display text-primary-text text-balance sm:text-headline lg:text-[3rem] lg:leading-[1.1]">{t("common.yourMarketUpClose")}</h1>
            <p className="text-body text-secondary-text sm:text-[1.0625rem]">{t("site.home.heroSubtitle")}</p>
          </div>
          <nav aria-label={t("common.market")} className="w-full">
            <ul className="flex flex-wrap justify-center gap-3">
              {categories.map((category) => (
                <li key={category} className={ENTRY_TILE_ITEM}>
                  <EntryTile
                    href={marketHref(category)}
                    icon={KIND_ICON[category]}
                    title={translate(MARKET_CATEGORY_LABEL_KEYS[category])}
                    cue={t("common.viewAll")}
                  />
                </li>
              ))}
            </ul>
          </nav>
          <div className="w-full max-w-xl">
            <HeroSearch
              action={getPathname({ locale, href: INDEXABLE_PAGES.market })}
              hidden={{ categoria: marketQueryParams({ ...MARKET_DEFAULT_QUERY, category: "all" }).categoria }}
            />
          </div>
          <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href={SIGN_IN_PATH} prefetch={false} className="sm:w-auto! sm:min-w-48">
              {signIn}
            </ButtonLink>
            <StoreButton kind="secondary" className="sm:w-auto!" />
          </div>
        </div>
      </section>

      {market && market.categories.length > 0 ? (
        <section aria-labelledby="home-market" className={cn(PAGE_CONTAINER, "pb-16 md:pb-24")}>
          <h2 id="home-market" className="sr-only">
            {t("common.market")}
          </h2>
          <MarketPreview
            label={t("common.market")}
            tabs={market.categories.map(({ category, rows }) => ({
              title: translate(MARKET_CATEGORY_LABEL_KEYS[category]),
              href: marketHref(category),
              rows,
            }))}
          />
        </section>
      ) : null}

      <section aria-labelledby="all-in-one" className="border-t border-hairline">
        <div className={cn(HOME_SECTION, "flex flex-col gap-12 md:gap-16")}>
          <h2 id="all-in-one" className={cn(HOME_HEADING, "mx-auto max-w-2xl text-center")}>
            {t("site.home.allInOneTitle")}
          </h2>
          <div className="grid items-center gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-16">
            <ul className="flex flex-col gap-8">
              <FactItem icon="markets" title={market ? t("common.instrumentsCount", { arg1: String(market.total) }) : t("common.instruments")}>
                {t("site.home.instrumentsLine")}
              </FactItem>
              <FactItem icon="alert" title={t("onboarding.preview.priceAlerts")}>
                {t("site.home.alertsLine")}
              </FactItem>
              <FactItem icon="portfolio" title={t("common.portfolio")}>
                {t("site.home.portfolioLine")}
              </FactItem>
            </ul>
            <HubDiagram />
          </div>
        </div>
      </section>

      <div className="flex flex-col py-4 md:py-8">
        <FeatureRow
          id="theme-market"
          icon="markets"
          title={t("onboarding.page.marketTitle")}
          message={t("onboarding.page.marketMessage")}
          action={
            <ButtonLink href={INDEXABLE_PAGES.market} prefetch={false} className="sm:w-auto!">
              {t("common.explore")}
            </ButtonLink>
          }
          visual={
            <>
              <PhoneFigure className="max-w-56!">
                <Screenshot image={instrument} alt={t("site.home.instrumentAlt")} />
              </PhoneFigure>
              <PhoneFigure className="max-w-56! translate-y-10 max-[26rem]:hidden">
                <Screenshot image={comparison} alt={t("site.home.comparisonAlt")} />
              </PhoneFigure>
            </>
          }
        />
        <FeatureRow
          id="theme-watchlist"
          icon="watchlist"
          flip
          title={t("onboarding.page.watchlistTitle")}
          message={t("onboarding.page.watchlistMessage")}
          action={
            <ButtonLink href="/lista" prefetch={false} className="sm:w-auto!">
              {t("common.follow")}
            </ButtonLink>
          }
          visual={
            <PhoneFigure className="max-w-64!">
              <Screenshot image={alerts} alt={t("site.home.alertsAlt")} />
            </PhoneFigure>
          }
        />
        <FeatureRow
          id="theme-portfolio"
          icon="portfolio"
          title={t("onboarding.page.portfolioTitle")}
          message={t("onboarding.page.portfolioMessage")}
          action={
            <ButtonLink href="/carteira" prefetch={false} className="sm:w-auto!">
              {t("common.recordPurchase")}
            </ButtonLink>
          }
          visual={
            <PhoneFigure className="max-w-64!">
              <PortfolioIllustration label={t("site.home.portfolioAlt")} />
            </PhoneFigure>
          }
        />
      </div>

      <section aria-labelledby="plus" className={HOME_SECTION}>
        <div className="panel grid items-center gap-10 overflow-hidden p-6 sm:p-10 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16 md:p-14">
          <div className="flex flex-col items-start gap-6">
            <h2 id="plus" className={HOME_HEADING}>
              {t("subscriptions.management.plusTitle")}
            </h2>
            <ul className="flex flex-col gap-4">
              {(["benefitWatchlist", "benefitMovements", "benefitComparisons"] as const).map((key) => (
                <li key={key} className="flex items-start gap-3 text-body font-medium text-primary-text">
                  <Icon name="check-circle" className="mt-px text-[1.25rem] text-accent" />
                  {t(`subscriptions.gift.${key}`)}
                </li>
              ))}
            </ul>
            <StoreButton className="mt-2 sm:w-auto!" />
          </div>
          <div aria-hidden className="hidden size-56 items-center justify-center rounded-full bg-accent-soft text-accent md:flex lg:size-64">
            <PalancaMark className="size-1/2" />
          </div>
        </div>
      </section>

      <section aria-labelledby="download" className={cn(PAGE_CONTAINER, "pb-16 md:pb-24")}>
        <div className="panel relative isolate flex flex-col items-center gap-6 overflow-hidden px-6 py-14 text-center md:py-20">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_100%,var(--accent-soft),transparent)]" />
          <PalancaMark className="size-14 text-primary-text" />
          <h2 id="download" className={HOME_HEADING}>
            {t("site.meta.homeTitle")}
          </h2>
          <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <StoreButton className="sm:w-auto!" />
            <ButtonLink href={SIGN_IN_PATH} prefetch={false} kind="secondary" className="sm:w-auto!">
              {signIn}
            </ButtonLink>
          </div>
        </div>
      </section>
    </main>
  );
}
