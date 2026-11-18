"use client";

import { useTranslations } from "next-intl";

import { Bento, BentoCard, FeatureRow, HERO_TITLE, HeroBackdrop, HeroFigures } from "@/features/site/home";
import {
  InstrumentVisual,
  LearnMiniature,
  NewsMiniature,
  PortfolioVisual,
  SimulatorMiniature,
  StoreButton,
  UnusualActivityMiniature,
  WatchlistVisual,
  WeekAheadMiniature,
} from "@/features/site/visuals";
import { ButtonLink } from "@/ui/components/buttons";

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

      <Specimen name="FeatureRow · InstrumentVisual (stage, caption)">
        <div className="w-full">
          <FeatureRow
            id="gallery-feature-row"
            icon="markets"
            title={t("onboarding.page.marketTitle")}
            message={t("onboarding.page.marketMessage")}
            action={
              <ButtonLink href="/mercado" prefetch={false} className="sm:w-auto!">
                {t("common.explore")}
              </ButtonLink>
            }
            visual={<InstrumentVisual label={t("site.home.instrumentAlt")} />}
          />
        </div>
      </Specimen>

      <div className={SPECIMEN_GRID}>
        <Specimen name="WatchlistVisual">
          <WatchlistVisual label={t("site.home.alertsAlt")} />
        </Specimen>
        <Specimen name="PortfolioVisual">
          <PortfolioVisual label={t("site.home.portfolioAlt")} />
        </Specimen>
      </div>

      <Specimen name="Bento · BentoCard (wide, wash, bleed corner) · miniatures">
        <div className="w-full">
          <Bento>
            <BentoCard href="/simulador" title={t("common.simulateInvestment")} wide wash bleed="corner">
              <SimulatorMiniature />
            </BentoCard>
            <BentoCard href="/atividade-invulgar" title={t("unusualActivity.title")}>
              <UnusualActivityMiniature />
            </BentoCard>
            <BentoCard href="/noticias" title={t("common.news")}>
              <NewsMiniature />
            </BentoCard>
            <BentoCard href="/aprender" title={t("learn.title")}>
              <LearnMiniature />
            </BentoCard>
            <BentoCard href="/semana" title={t("weekAhead.header.navigationTitle")}>
              <WeekAheadMiniature />
            </BentoCard>
          </Bento>
        </div>
      </Specimen>

      <Specimen name="StoreButton">
        <StoreButton className="sm:w-auto!" />
        <StoreButton kind="secondary" className="sm:w-auto!" />
      </Specimen>
    </GallerySection>
  );
}
