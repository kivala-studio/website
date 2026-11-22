import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { requestTime } from "@/data/clock";
import { type FormatLocale, createFormat } from "@/domain/format";
import { MARKET_CATEGORY_LABEL_KEYS, type MarketCategory } from "@/domain/market";
import { MARKET_DEFAULT_QUERY, marketQueryParams } from "@/features/market/browse/query";
import { CoverageFigures, DeckCard, HeroPanel, SectionIntro, STAGE_SPACE, Stage } from "@/features/site/home";
import { Deck, MarketPreview, MarketSearch } from "@/features/site/home-client";
import { homeMarket } from "@/features/site/home-market";
import { pageMetadata } from "@/features/site/metadata";
import { INDEXABLE_PAGES } from "@/features/site/site";
import { Reveal } from "@/features/site/reveal";
import { OrganizationData } from "@/features/site/structured-data";
import {
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
import { PAGE_CONTAINER, SectionChip } from "@/ui/components/layout";
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
 * The landing page, one flat fill per stretch: the hero panel (`stage-deep`: the title and the App Store pill); on the
 * canvas, the market (intro, search, coverage figures and the market preview) and following it (intro and a deck);
 * on a `stage-deep` band, the portfolio (intro and a deck) and Plus; on `stage-brand`, the closing line, which the
 * footer continues. Market rows and counts come from the cached catalogue (dated verified closes), the same server
 * path as `/mercado`. The hero's title rises once on load (`motion-entrance-lift`, no fade); the sections below ease
 * in as they enter the viewport (`data-reveal`, driven by `Reveal`).
 */
export default async function HomePage() {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const translate = (key: string) => t(key as never);
  const market = await homeMarket(requestTime());
  const format = createFormat(locale as FormatLocale, (key, values) => t(key as never, values as never));

  return (
    <main id="main">
      <OrganizationData />
      <Reveal />

      <HeroPanel labelledBy="home-title">
        <h1 id="home-title" className="max-w-[13ch] motion-entrance-lift text-hero text-balance">
          {t("common.yourMarketUpClose")}
        </h1>
        <div className="flex max-w-full motion-entrance entrance-delay-70">
          <StoreButton size="large" fill="bg-on-stage-deep text-stage-deep hover:bg-on-stage-deep/90 max-sm:whitespace-normal" />
        </div>
      </HeroPanel>

      <section aria-labelledby="home-market" className={cn(STAGE_SPACE, "flex flex-col gap-12 md:gap-16")}>
        <SectionIntro id="home-market" title={t("onboarding.page.marketTitle")} action={{ href: INDEXABLE_PAGES.market, label: t("common.explore") }} />
        <div className={cn(PAGE_CONTAINER, "flex flex-col items-center gap-6")}>
          <div className="w-full max-w-xl">
            <MarketSearch
              action={getPathname({ locale, href: INDEXABLE_PAGES.market })}
              hidden={{ categoria: marketQueryParams({ ...MARKET_DEFAULT_QUERY, category: "all" }).categoria }}
            />
          </div>
          {market ? (
            <CoverageFigures
              total={{ value: format.count(market.total), label: t("common.instruments") }}
              items={market.categories.map(({ category, count }) => ({ value: format.count(count), label: translate(MARKET_CATEGORY_LABEL_KEYS[category]) }))}
            />
          ) : null}
        </div>
        {market && market.categories.length > 0 ? (
          <div data-reveal className={PAGE_CONTAINER}>
            <div className="mx-auto w-full max-w-5xl">
              <MarketPreview
                label={t("common.market")}
                tabs={market.categories.map(({ category, rows }) => ({
                  title: translate(MARKET_CATEGORY_LABEL_KEYS[category]),
                  href: marketHref(category),
                  rows,
                }))}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="home-follow" className={cn(STAGE_SPACE, "flex flex-col gap-12 pb-24 md:gap-16 md:pb-36")}>
        <SectionIntro id="home-follow" title={t("onboarding.page.watchlistTitle")} action={{ href: "/lista", label: t("common.follow") }} />
        <Deck
          id="home-follow-deck"
          label={t("common.watchlistTab")}
          chip={<SectionChip icon="watchlist">{t("common.watchlistTab")}</SectionChip>}
        >
          <DeckCard href="/lista" tone="brand" statement={t("onboarding.page.watchlistMessage")}>
            <WatchlistVisual />
          </DeckCard>
          <DeckCard href="/atividade-invulgar" tone="deep" statement={t("unusualActivity.title")}>
            <UnusualActivityMiniature />
          </DeckCard>
          <DeckCard href="/semana" tone="pale" statement={t("weekAhead.header.navigationTitle")}>
            <WeekAheadMiniature />
          </DeckCard>
          <DeckCard href={INDEXABLE_PAGES.news} tone="ink" statement={t("common.news")}>
            <NewsMiniature />
          </DeckCard>
        </Deck>
      </section>

      <Stage tone="deep" className="pb-24 md:pb-36">
        <section aria-labelledby="home-portfolio" className={cn(STAGE_SPACE, "flex flex-col gap-12 md:gap-16")}>
          <SectionIntro
            id="home-portfolio"
            tone="deep"
            title={t("onboarding.page.portfolioTitle")}
            action={{ href: "/carteira", label: t("common.recordPurchase") }}
          />
          <Deck
            id="home-portfolio-deck"
            label={t("common.portfolio")}
            chip={<SectionChip icon="portfolio">{t("common.portfolio")}</SectionChip>}
          >
            <DeckCard href="/carteira" tone="brand" statement={t("onboarding.page.portfolioMessage")}>
              <PortfolioVisual />
            </DeckCard>
            <DeckCard href="/simulador" tone="ink" statement={t("common.simulateInvestment")}>
              <SimulatorMiniature />
            </DeckCard>
            <DeckCard href={INDEXABLE_PAGES.learn} tone="pale" statement={t("learn.title")}>
              <LearnMiniature />
            </DeckCard>
          </Deck>
        </section>

        <section aria-labelledby="plus" className={cn(STAGE_SPACE, "flex flex-col gap-12 md:gap-16")}>
          <SectionIntro
            id="plus"
            tone="deep"
            title={t("subscriptions.management.plusTitle")}
            action={{ href: INDEXABLE_PAGES.plus, label: t("site.plus.comparePlans") }}
          />
          <div className={PAGE_CONTAINER}>
            {/* A pale card on the deep band: its controls ring in the accent again. */}
            <div
              data-reveal
              className="grid items-center gap-10 rounded-card bg-stage-pale p-5 text-on-stage-pale [--focus-ring:var(--accent)] max-[22.5rem]:px-4 sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:p-14"
            >
              <div className="flex flex-col items-start gap-8">
                <ul className="flex flex-col gap-5">
                  {(["benefitWatchlist", "benefitMovements", "benefitComparisons"] as const).map((key) => (
                    <li key={key} className="flex items-start gap-3 font-display text-lead">
                      <Icon name="check-circle" className="mt-[0.2em] shrink-0 text-[1.25rem] text-accent" />
                      {t(`subscriptions.gift.${key}`)}
                    </li>
                  ))}
                </ul>
                <StoreButton className="sm:w-auto!" />
              </div>
              <PlusVisual label={t("site.home.plusAlt")} />
            </div>
          </div>
        </section>
      </Stage>

      <Stage tone="brand" className="pb-20 md:pb-28">
        <section aria-labelledby="download" data-reveal="stagger" className={cn(PAGE_CONTAINER, STAGE_SPACE, "flex flex-col items-center gap-6 text-center")}>
          <p className="max-w-[24ch] font-display text-lead text-balance">{t("site.home.heroSubtitle")}</p>
          <h2 id="download" className="max-w-5xl text-heading text-balance">
            {t("common.yourMarketUpClose")}
          </h2>
          <div className="mt-6 flex max-w-full">
            <StoreButton size="large" fill="bg-card-background text-primary-text hover:bg-accent-soft max-sm:whitespace-normal" />
          </div>
        </section>
      </Stage>
    </main>
  );
}
