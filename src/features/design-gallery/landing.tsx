"use client";

import { useTranslations } from "next-intl";

import { FactItem, HERO_TITLE, HeroBackdrop, HeroFigures } from "@/features/site/home";
import { InstrumentVisual, PortfolioVisual, StoreButton } from "@/features/site/visuals";

import { GallerySection, SPECIMEN_GRID, Specimen } from "./specimen";

/** Sample counts; the landing reads them from the catalogue. */
const FIGURES = [
  { value: "24", key: "common.instruments" },
  { value: "6", key: "common.stocks" },
  { value: "18", key: "common.bonds" },
] as const;

export function Landing() {
  const t = useTranslations();
  return (
    <GallerySection id="landing" title="Landing pieces">
      <Specimen name="HeroBackdrop · HERO_TITLE · HeroFigures">
        <div className="relative isolate flex w-full flex-col items-center gap-6 overflow-hidden rounded-card px-4 py-12 text-center">
          <HeroBackdrop />
          <p className={HERO_TITLE}>{t("common.yourMarketUpClose")}</p>
          <HeroFigures items={FIGURES.map((item) => ({ value: item.value, label: t(item.key) }))} />
        </div>
      </Specimen>

      <div className={SPECIMEN_GRID}>
        <Specimen name="InstrumentVisual (stage, caption)">
          <InstrumentVisual label={t("site.home.instrumentAlt")} />
        </Specimen>
        <Specimen name="PortfolioVisual">
          <PortfolioVisual label={t("site.home.portfolioAlt")} />
        </Specimen>
      </div>

      <div className={SPECIMEN_GRID}>
        <Specimen name="FactItem">
          <ul className="flex flex-col gap-8">
            <FactItem icon="alert" title={t("onboarding.preview.priceAlerts")}>
              {t("site.home.alertsLine")}
            </FactItem>
          </ul>
        </Specimen>
        <Specimen name="StoreButton">
          <StoreButton className="sm:w-auto!" />
          <StoreButton kind="secondary" className="sm:w-auto!" />
        </Specimen>
      </div>
    </GallerySection>
  );
}
