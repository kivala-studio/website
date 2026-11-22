import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { getPublicWebPlans } from "@/data/billing/public-plans";
import { annualSaving } from "@/domain/billing/web-pass";
import { type FormatLocale, createFormat } from "@/domain/format";
import { appHref } from "@/features/site/app-href";
import { SectionIntro, STAGE_SPACE, Stage } from "@/features/site/home";
import { type LocaleParams, pageMetadata } from "@/features/site/metadata";
import { HERO_PILL_FILL, type PlusFeature, PlusComparison, PlusHero, PlusPasses } from "@/features/site/plus";
import { Reveal } from "@/features/site/reveal";
import { INDEXABLE_PAGES } from "@/features/site/site";
import { StoreButton } from "@/features/site/visuals";
import { cn } from "@/ui/cn";
import { PAGE_CONTAINER } from "@/ui/components/layout";

/** `/planos`, the signed-in checkout the pay pill opens (on the app's host when it has one). */
const CHECKOUT_PATH = "/planos";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const [t, plans] = await Promise.all([getTranslations({ locale }), getPublicWebPlans()]);
  return pageMetadata({
    locale,
    path: INDEXABLE_PAGES.plus,
    title: t("subscriptions.management.plusTitle"),
    description: t(plans.length > 0 ? "site.meta.plusDescription" : "site.meta.plusStoreDescription"),
    image: "plus",
    absoluteTitle: true,
  });
}

/**
 * Plus, the only paid plan, for everyone: the prepaid passes in kwanzas as the hero (prices from `get_web_plans()`,
 * cached for 5 minutes, never written in code), what Plus adds to the free plan (the iOS comparison) and the App Store
 * as the other way to get it. With no passes on sale, or when they cannot be read, the hero offers the App Store and the
 * page names no price, no Multicaixa and no pay action. Never linked from the pages the iOS app or the store listings
 * open (`(store-linked)`).
 */
export default async function PlusPage() {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const format = createFormat(locale as FormatLocale, (key, values) => t(key as never, values as never));
  const plans = await getPublicWebPlans();
  const saving = annualSaving(plans);

  const comparison: PlusFeature[] = [
    { feature: t("common.watchlistTab"), free: t("subscriptions.comparison.watchlistFree"), plus: t("subscriptions.comparison.watchlistPlus") },
    { feature: t("common.alerts"), free: t("subscriptions.comparison.movementsFree"), plus: t("subscriptions.comparison.movementsPlus") },
    { feature: t("common.comparison"), free: t("subscriptions.comparison.pairsFree"), plus: t("subscriptions.comparison.pairsPlus") },
    { feature: t("income.title"), free: t("subscriptions.comparison.incomeFree"), plus: t("subscriptions.comparison.incomePlus") },
    { feature: t("benchmark.title"), free: null, plus: t("subscriptions.comparison.benchmarkPlus") },
    { feature: t("portfolioBooks.title"), free: format.count(1), plus: format.count(10) },
    { feature: t("statement.read"), free: t("subscriptions.comparison.csvOnly"), plus: t("subscriptions.comparison.photoAndPDF") },
    { feature: t("report.export"), free: null, plus: t("subscriptions.comparison.reportPlus") },
    { feature: t("cash.title"), free: null, plus: t("subscriptions.comparison.cashPlus") },
    { feature: t("subscriptions.comparison.history"), free: t("common.oneYear"), plus: t("common.all") },
    { feature: t("assetDetails.exportHistory"), free: null, plus: t("subscriptions.comparison.csvOnly") },
    { feature: t("subscriptions.comparison.alertRules"), free: format.count(2), plus: t("subscriptions.comparison.unlimited") },
    { feature: t("watchlist.groups.title"), free: null, plus: format.count(20) },
    { feature: t("liquidity.title"), free: null, plus: t("subscriptions.comparison.liquidityPlus") },
  ];

  return (
    <main id="main">
      <Reveal />

      <PlusHero title={t("subscriptions.management.plusTitle")}>
        {plans.length > 0 ? (
          <PlusPasses
            passes={plans.map((plan) => ({
              id: plan.id,
              months: t("site.plans.months", { count: plan.months }),
              price: format.currency(plan.priceAOA, { digits: 2 }),
              saving: saving && plan.months === 12 ? t("subscriptions.plan.savings", { arg1: format.number(saving.percent, { digits: 0 }) }) : undefined,
            }))}
            methods={t("site.plus.methods")}
            pay={{ href: appHref(CHECKOUT_PATH, locale), label: t("subscriptions.button.continuePlus") }}
          />
        ) : (
          <div className="flex max-w-full motion-entrance entrance-delay-70">
            <StoreButton size="large" fill={HERO_PILL_FILL} />
          </div>
        )}
      </PlusHero>

      <section aria-labelledby="plus-includes" className={cn(STAGE_SPACE, "flex flex-col gap-12 pb-24 md:gap-16 md:pb-36")}>
        <SectionIntro id="plus-includes" title={t("site.plus.includes")} />
        <div data-reveal className={PAGE_CONTAINER}>
          <PlusComparison rows={comparison} labelledBy="plus-includes" />
        </div>
      </section>

      {plans.length > 0 ? (
        <Stage tone="brand" className="pb-20 md:pb-28">
          <section aria-labelledby="plus-store" data-reveal="stagger" className={cn(PAGE_CONTAINER, "flex flex-col items-center gap-8 pt-20 text-center md:pt-28")}>
            <h2 id="plus-store" className="max-w-[24ch] font-display text-lead text-balance">
              {t("site.plans.storeOnly")}
            </h2>
            <div className="flex max-w-full">
              <StoreButton size="large" fill="bg-card-background text-primary-text hover:bg-accent-soft max-sm:whitespace-normal" />
            </div>
          </section>
        </Stage>
      ) : null}
    </main>
  );
}
