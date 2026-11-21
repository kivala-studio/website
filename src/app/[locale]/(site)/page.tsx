import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { requestTime } from "@/data/clock";
import { type FormatLocale, createFormat } from "@/domain/format";
import { MARKET_CATEGORY_LABEL_KEYS, type MarketCategory } from "@/domain/market";
import { MARKET_DEFAULT_QUERY, marketQueryParams } from "@/features/market/browse/query";
import { PalancaMark } from "@/features/site/chrome";
import { Bento, BentoCard, CLOSING_TITLE, FeatureRow, FeatureRows, HERO_TITLE, HOME_HEADING, HOME_SECTION, HeroBackdrop, HeroFigures, Showcase } from "@/features/site/home";
import { HeroSearch, MarketPreview } from "@/features/site/home-client";
import { homeMarket } from "@/features/site/home-market";
import { pageMetadata } from "@/features/site/metadata";
import { INDEXABLE_PAGES, SIGN_IN_PATH } from "@/features/site/site";
import { Reveal } from "@/features/site/reveal";
import { OrganizationData } from "@/features/site/structured-data";
import {
  InstrumentVisual,
  LearnMiniature,
  NewsMiniature,
  PlusVisual,
  PortfolioVisual,
  SimulatorMiniature,
  StoreButton,
  UnusualActivityMiniature,
  WatchlistVisual,
  WeekAheadMiniature,
} from "@/features/site/visuals";
import { getPathname } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { ButtonLink } from "@/ui/components/buttons";
import { PAGE_CONTAINER } from "@/ui/components/layout";
import { Icon } from "@/ui/icons/icon";

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

/** `/mercado` filtered to one kind (the canonical `/mercado` for the default kind). */
const marketHref = (category: MarketCategory) => ({
  pathname: INDEXABLE_PAGES.market,
  query: marketQueryParams({ ...MARKET_DEFAULT_QUERY, category }),
});

/**
 * The landing page: the hero (title, search, actions, coverage figures) with the market preview rising out of it as
 * the showcase; the product's other areas as a bento; three feature rows; then Plus and the closing line over the
 * hero's light mirrored, rising onto the footer. Market rows and counts come from the cached catalogue (dated
 * verified closes), the same server path as `/mercado`. The hero comes in once on load (`motion-entrance`); the
 * sections below ease in as they enter the viewport (`data-reveal`, driven by `Reveal`).
 */
export default async function HomePage() {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const translate = (key: string) => t(key as never);
  const market = await homeMarket(requestTime());
  const format = createFormat(locale as FormatLocale, (key, values) => t(key as never, values as never));
  const signIn = t("onboarding.navigation.signIn");

  return (
    <main id="main">
      <OrganizationData />
      <Reveal />

      {/* The hero runs up under the floating top bar, so its light starts at the top of the window. */}
      <div className="relative isolate -mt-(--top-bar-height) overflow-hidden pt-(--top-bar-height)">
        <HeroBackdrop />
        {/* Phones (below 640 px): three groups with room between them, one action (the top bar already signs in). */}
        <section className={cn(PAGE_CONTAINER, "flex flex-col items-center gap-8 pt-12 pb-12 text-center sm:pt-10 sm:pb-10 md:pt-20 md:pb-14 lg:pt-24")}>
          <div className="flex max-w-4xl flex-col items-center gap-4 sm:gap-5">
            <h1 className={cn(HERO_TITLE, "motion-entrance-lift")}>{t("common.yourMarketUpClose")}</h1>
            <p className="max-w-xl motion-entrance entrance-delay-70 text-body text-balance text-secondary-text max-sm:max-w-80 max-sm:leading-[1.45] sm:text-[1.1875rem] sm:leading-normal">
              {t("site.home.heroSubtitle")}
            </p>
          </div>
          <div className="flex w-full max-w-xl motion-entrance entrance-delay-140 flex-col items-center gap-3 sm:gap-4">
            <HeroSearch
              action={getPathname({ locale, href: INDEXABLE_PAGES.market })}
              hidden={{ categoria: marketQueryParams({ ...MARKET_DEFAULT_QUERY, category: "all" }).categoria }}
            />
            <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
              <ButtonLink href={SIGN_IN_PATH} prefetch={false} className="max-sm:hidden sm:w-auto! sm:min-w-48">
                {signIn}
              </ButtonLink>
              <StoreButton className="sm:hidden" />
              <StoreButton kind="secondary" className="max-sm:hidden sm:w-auto!" />
            </div>
          </div>
          {market ? (
            <HeroFigures
              className="motion-entrance entrance-delay-210 max-sm:mt-2"
              total={{ value: format.count(market.total), label: t("common.instruments") }}
              items={market.categories.map(({ category, count }) => ({ value: format.count(count), label: translate(MARKET_CATEGORY_LABEL_KEYS[category]) }))}
            />
          ) : null}
        </section>

        {market && market.categories.length > 0 ? (
          <section aria-labelledby="home-market" className={cn(PAGE_CONTAINER, "motion-entrance entrance-delay-280 pb-16 md:pb-24")}>
            <h2 id="home-market" className="sr-only">
              {t("common.market")}
            </h2>
            <Showcase>
              <MarketPreview
                label={t("common.market")}
                tabs={market.categories.map(({ category, rows }) => ({
                  title: translate(MARKET_CATEGORY_LABEL_KEYS[category]),
                  href: marketHref(category),
                  rows,
                }))}
              />
            </Showcase>
          </section>
        ) : null}
      </div>

      <section aria-labelledby="all-in-one" className={cn(PAGE_CONTAINER, "flex flex-col gap-10 pb-8 md:gap-12 md:pb-10")}>
        <h2 id="all-in-one" data-reveal className={cn(HOME_HEADING, "mx-auto max-w-2xl text-center")}>
          {t("site.home.allInOneTitle")}
        </h2>
        <Bento>
          <BentoCard href="/simulador" title={t("common.simulateInvestment")} wide wash bleed="corner">
            <SimulatorMiniature />
          </BentoCard>
          <BentoCard href="/atividade-invulgar" title={t("unusualActivity.title")}>
            <UnusualActivityMiniature />
          </BentoCard>
          <BentoCard href={INDEXABLE_PAGES.news} title={t("common.news")}>
            <NewsMiniature />
          </BentoCard>
          <BentoCard href={INDEXABLE_PAGES.learn} title={t("learn.title")}>
            <LearnMiniature />
          </BentoCard>
          <BentoCard href="/semana" title={t("weekAhead.header.navigationTitle")}>
            <WeekAheadMiniature />
          </BentoCard>
        </Bento>
      </section>

      <FeatureRows>
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
          visual={<InstrumentVisual label={t("site.home.instrumentAlt")} />}
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
          visual={<WatchlistVisual label={t("site.home.alertsAlt")} />}
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
          visual={<PortfolioVisual label={t("site.home.portfolioAlt")} />}
        />
      </FeatureRows>

      <div className="relative isolate overflow-hidden">
        <HeroBackdrop edge="bottom" />
        <section aria-labelledby="plus" className={HOME_SECTION}>
          <div data-reveal className="panel relative isolate grid items-center gap-10 overflow-hidden border-accent/25 p-5 max-[22.5rem]:px-4 sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:p-14">
            <div aria-hidden className="bento-wash absolute inset-0 -z-10" />
            <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent),transparent)] opacity-50" />
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
            <PlusVisual label={t("site.home.plusAlt")} />
          </div>
        </section>

        <section aria-labelledby="download" data-reveal="stagger" className={cn(PAGE_CONTAINER, "flex flex-col items-center gap-8 pb-16 text-center md:pb-24")}>
          <span className="flex size-16 items-center justify-center rounded-[1.25rem] bg-accent text-on-accent shadow-panel">
            <PalancaMark className="size-10" />
          </span>
          <h2 id="download" className={cn(CLOSING_TITLE, "max-w-3xl")}>
            {t("common.yourMarketUpClose")}
          </h2>
          <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <StoreButton className="sm:w-auto! sm:min-w-48" />
            <ButtonLink href={SIGN_IN_PATH} prefetch={false} kind="outline" className="bg-card-background! hover:bg-action-surface! sm:w-auto! sm:min-w-48">
              {signIn}
            </ButtonLink>
          </div>
        </section>
      </div>
    </main>
  );
}
