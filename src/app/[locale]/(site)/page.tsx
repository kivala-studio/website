import type { Metadata } from "next";
import { type Locale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { StaticImageData } from "next/image";

import alerts from "@/features/site/assets/alerts.webp";
import comparison from "@/features/site/assets/comparison.webp";
import instrument from "@/features/site/assets/instrument.webp";
import { PAGE_WIDTH, PalancaMark } from "@/features/site/chrome";
import { pageMetadata } from "@/features/site/metadata";
import { OrganizationData } from "@/features/site/structured-data";
import { PhoneFigure, PortfolioIllustration, Screenshot, StoreButton } from "@/features/site/visuals";
import { cn } from "@/ui/cn";

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

/** The three introduction themes of the iOS app (product §2.14), each with its own visual. */
const THEMES = [
  { key: "market", visual: { image: comparison, alt: "comparisonAlt" } },
  { key: "watchlist", visual: { image: alerts, alt: "alertsAlt" } },
  { key: "portfolio", visual: null },
] as const satisfies readonly { key: string; visual: { image: StaticImageData; alt: string } | null }[];

export default function HomePage() {
  const t = useTranslations();

  return (
    <main id="main">
      <OrganizationData />
      <section className={cn(PAGE_WIDTH, "grid items-center gap-12 pt-6 pb-16 md:grid-cols-[minmax(0,1fr)_18rem] md:gap-16 md:pt-12 md:pb-24 lg:grid-cols-[minmax(0,1fr)_20rem]")}>
        <div className="flex max-w-xl flex-col items-start gap-6">
          <h1 className="text-display text-primary-text sm:text-headline">{t("common.yourMarketUpClose")}</h1>
          <p className="text-body text-secondary-text sm:text-price sm:font-normal">{t("site.meta.homeDescription")}</p>
          <StoreButton className="w-full sm:w-auto" />
        </div>
        <PhoneFigure className="mx-auto md:max-w-none">
          <Screenshot image={instrument} alt={t("site.home.instrumentAlt")} eager />
        </PhoneFigure>
      </section>

      {THEMES.map(({ key, visual }, index) => (
        <section key={key} aria-labelledby={`theme-${key}`} className="border-t border-separator">
          <div className={cn(PAGE_WIDTH, "grid items-center gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-24")}>
            <div className={cn("flex max-w-md flex-col gap-4", index % 2 === 1 && "md:order-2 md:justify-self-start")}>
              <h2 id={`theme-${key}`} className="text-display text-primary-text">
                {t(`onboarding.page.${key}Title`)}
              </h2>
              <p className="text-body text-secondary-text sm:text-price sm:font-normal">{t(`onboarding.page.${key}Message`)}</p>
            </div>
            <PhoneFigure className="mx-auto">
              {visual ? (
                <Screenshot image={visual.image} alt={t(`site.home.${visual.alt}`)} />
              ) : (
                <PortfolioIllustration label={t("site.home.portfolioAlt")} />
              )}
            </PhoneFigure>
          </div>
        </section>
      ))}

      <section aria-labelledby="download" className="border-t border-separator">
        <div className={cn(PAGE_WIDTH, "flex flex-col items-center gap-6 py-16 text-center md:py-24")}>
          <PalancaMark className="size-16 text-primary-text" />
          <h2 id="download" className="text-display text-primary-text">
            {t("site.meta.homeTitle")}
          </h2>
          <StoreButton className="w-full sm:w-auto" />
        </div>
      </section>
    </main>
  );
}
