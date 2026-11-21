"use client";

import { useTranslations } from "next-intl";

import { CoverageFigures, DeckCard, HeroPanel, MarkedText, SectionIntro, Stage } from "@/features/site/home";
import { Deck, MarketSearch } from "@/features/site/home-client";
import {
  IllustrativeCaption,
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

import { GallerySection, Specimen } from "./specimen";

/** Sample counts; the landing reads them from the catalogue. */
const TOTAL = { value: "24", key: "common.instruments" } as const;
const FIGURES = [
  { value: "6", key: "common.stocks" },
  { value: "18", key: "common.bonds" },
] as const;

export function Landing() {
  const t = useTranslations();
  return (
    <GallerySection id="landing" title="Landing pieces">
      <Specimen name="HeroPanel (shortened) · text-hero · StoreButton large">
        <HeroPanel labelledBy="gallery-hero" className="mx-0! min-h-96! w-full lg:min-h-96!">
          <p id="gallery-hero" className="max-w-[13ch] font-display text-hero text-balance">
            {t("common.yourMarketUpClose")}
          </p>
          <StoreButton size="large" fill="bg-on-stage-deep text-stage-deep hover:bg-on-stage-deep/90 max-sm:whitespace-normal" />
        </HeroPanel>
      </Specimen>

      <Specimen name="SectionIntro · MarkedText (canvas)">
        <div className="rounded-card bg-canvas py-12">
          <SectionIntro id="gallery-intro" title={t("onboarding.page.watchlistTitle")} action={{ href: "/lista", label: t("common.follow") }} />
        </div>
      </Specimen>

      <Specimen name='Stage tone="deep" · SectionIntro tone="deep" · Deck · DeckCard'>
        <Stage tone="deep" className="flex flex-col gap-10 overflow-hidden rounded-card py-12">
          <SectionIntro id="gallery-deck-intro" tone="deep" title={t("onboarding.page.portfolioTitle")} action={{ href: "/carteira", label: t("common.recordPurchase") }} />
          <Deck id="gallery-deck" label={t("common.portfolio")} caption={<IllustrativeCaption className="px-4 text-on-stage-deep sm:px-6" />} chip={null}>
            <DeckCard href="/carteira" tone="brand" statement={t("onboarding.page.portfolioMessage")}>
              <PortfolioVisual />
            </DeckCard>
            <DeckCard href="/lista" tone="ink" statement={t("onboarding.page.watchlistMessage")}>
              <WatchlistVisual />
            </DeckCard>
            <DeckCard href="/simulador" tone="pale" statement={t("common.simulateInvestment")}>
              <SimulatorMiniature />
            </DeckCard>
            <DeckCard href="/atividade-invulgar" tone="brand" statement={t("unusualActivity.title")}>
              <UnusualActivityMiniature />
            </DeckCard>
            <DeckCard href="/noticias" tone="ink" statement={t("common.news")}>
              <NewsMiniature />
            </DeckCard>
            <DeckCard href="/aprender" tone="pale" statement={t("learn.title")}>
              <LearnMiniature />
            </DeckCard>
            <DeckCard href="/semana" tone="brand" statement={t("weekAhead.header.navigationTitle")}>
              <WeekAheadMiniature />
            </DeckCard>
          </Deck>
        </Stage>
      </Specimen>

      <Specimen name='Stage tone="brand" · MarkedText · StoreButton fill'>
        <Stage tone="brand" className="flex flex-col items-center gap-6 rounded-card px-4 py-12 text-center">
          <p className="text-heading text-balance">
            <MarkedText text={t("common.yourMarketUpClose")} mark="text-current" />
          </p>
          <StoreButton size="large" fill="bg-card-background text-primary-text hover:bg-accent-soft max-sm:whitespace-normal" />
        </Stage>
      </Specimen>

      <Specimen name="MarketSearch · CoverageFigures">
        <div className="w-full max-w-xl">
          <MarketSearch action="/mercado" hidden={{}} />
        </div>
        <CoverageFigures total={{ value: TOTAL.value, label: t(TOTAL.key) }} items={FIGURES.map((item) => ({ value: item.value, label: t(item.key) }))} />
      </Specimen>

      <Specimen name="PlusVisual (on stage-pale)">
        <div className="w-full max-w-xl rounded-card bg-stage-pale p-5 text-on-stage-pale sm:p-8">
          <PlusVisual label={t("site.home.plusAlt")} />
        </div>
      </Specimen>

      <Specimen name="StoreButton">
        <StoreButton className="sm:w-auto!" />
        <StoreButton kind="secondary" className="sm:w-auto!" />
      </Specimen>
    </GallerySection>
  );
}
