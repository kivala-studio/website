"use client";

import { useTranslations } from "next-intl";

import { ENTRY_TILE_ITEM, EntryTile, FactItem } from "@/features/site/home";
import { InstrumentVisual, PortfolioVisual, StoreButton } from "@/features/site/visuals";

import { GallerySection, SPECIMEN_GRID, Specimen } from "./specimen";

const MARKET = { pathname: "/mercado", query: {} };

export function Landing() {
  const t = useTranslations();
  return (
    <GallerySection id="landing" title="Landing pieces">
      <Specimen name="EntryTile · ENTRY_TILE_ITEM">
        <ul className="flex flex-wrap gap-3">
          <li className={ENTRY_TILE_ITEM}>
            <EntryTile href={MARKET} icon="trend-up" title={t("common.stocks")} cue={t("common.viewAll")} />
          </li>
          <li className={ENTRY_TILE_ITEM}>
            <EntryTile href={MARKET} icon="bond" title={t("common.bonds")} cue={t("common.viewAll")} />
          </li>
        </ul>
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
