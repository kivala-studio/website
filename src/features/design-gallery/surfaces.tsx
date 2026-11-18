"use client";

import { useTranslations } from "next-intl";

import { ControlRow, DisclosureRow, LinkRow, SettingsGroup, ValueRow } from "@/features/settings/settings-ui";
import { cn } from "@/ui/cn";
import { ButtonLink } from "@/ui/components/buttons";
import { ThemeSwitch } from "@/ui/components/controls";
import { ChangeBadge, MarketStatusIndicator } from "@/ui/components/financial";
import { Card, CardHeader, MessageCard, PAGE_CONTAINER, Panel, READING_COLUMN, SectionHeader, StatStrip, StatTile } from "@/ui/components/layout";
import { SeeAll } from "@/ui/components/see-all";
import type { Theme } from "@/ui/theme/theme";

import { GallerySection, SPECIMEN_GRID, Specimen, Variant } from "./specimen";

export function Surfaces({ initialTheme }: { initialTheme: Theme }) {
  const t = useTranslations();
  const facts = [
    { title: t("common.trades"), value: "186" },
    { title: t("common.change"), value: "+2,14%", tone: "text-positive" },
    { title: t("common.price"), value: "72 500,00 Kz" },
    { title: t("designSystem.gallery.surface"), value: "—" },
  ];
  return (
    <GallerySection id="layout" title="Layout and surfaces">
      <Specimen name="PAGE_CONTAINER · READING_COLUMN">
        <div className="rounded-medium border border-dashed border-field-border">
          <div className={cn(PAGE_CONTAINER, "py-3")}>
            <code className="text-caption text-secondary-text">PAGE_CONTAINER · 1200 px · 16 / 24 px gutters</code>
            <div className={cn(READING_COLUMN, "mt-3 rounded-small border border-dashed border-accent p-3")}>
              <code className="text-caption text-secondary-text">READING_COLUMN · 768 px</code>
            </div>
          </div>
        </div>
      </Specimen>

      <div className={SPECIMEN_GRID}>
        <Specimen name="Card">
          <Card>
            <p className="text-body text-primary-text">{t("designSystem.gallery.sampleInsightMessage")}</p>
          </Card>
          <Variant label='compact surface="elevated"' className="items-stretch">
            <Card compact surface="elevated">
              <p className="text-body text-primary-text">{t("designSystem.gallery.surface")}</p>
            </Card>
          </Variant>
          <Variant label="title titleId action={<SeeAll />}" className="items-stretch">
            <Card title={t("common.yourWatchlist")} titleId="gallery-card-title" action={<SeeAll href="/dev/design" />}>
              <p className="text-body text-secondary-text">{t("designSystem.gallery.sampleInsightMessage")}</p>
            </Card>
          </Variant>
        </Specimen>

        <Specimen name="Panel">
          <Variant label="default: the canvas below 1024 px" className="items-stretch">
            <Panel title={t("designSystem.gallery.valuesHeader")} titleId="gallery-panel-title" action={<ButtonLink href="/dev/design" kind="outline" size="compact">{t("home.explore.header")}</ButtonLink>}>
              <p className="text-body text-secondary-text">{t("designSystem.gallery.sampleInsightMessage")}</p>
            </Panel>
          </Variant>
          <Variant label="always flush + StatStrip" className="items-stretch">
            <Panel title={t("markets.details.sessionData")} titleId="gallery-panel-strip" always flush>
              <StatStrip items={facts} />
            </Panel>
          </Variant>
        </Specimen>
      </div>

      <div className={SPECIMEN_GRID}>
        <Specimen name="StatTile">
          <Card>
            <dl className="grid grid-cols-2 gap-3">
              <StatTile
                size="large"
                className="col-span-2"
                label={t("common.appIndicator")}
                value={
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    1 234,56
                    <ChangeBadge value="0.84" />
                  </span>
                }
                detail={t("widgets.market.calculatedNotOfficial")}
              />
              <StatTile label={t("assetDetails.marketInfo.tradingStatus")} value={<MarketStatusIndicator status="open" size="value" />} />
              <StatTile label={t("markets.summary.transactions")} value="—" />
            </dl>
          </Card>
        </Specimen>

        <Specimen name='StatStrip variant="grid"'>
          <Card>
            <StatStrip variant="grid" items={facts} />
          </Card>
        </Specimen>
      </div>

      <div className={SPECIMEN_GRID}>
        <Specimen name="CardHeader · SectionHeader">
          <Card flush>
            <CardHeader title={t("common.onTheMove")} action={<SeeAll href="/dev/design" />} className="px-5 py-2 desk:px-6" />
          </Card>
          <SectionHeader title={t("designSystem.gallery.valuesHeader")} action={<SeeAll href="/dev/design" />} />
        </Specimen>

        <Specimen name="MessageCard">
          <MessageCard className="items-center text-center">
            <div className="flex flex-col gap-2">
              <p className="font-display text-display text-primary-text">{t("site.notFound.title")}</p>
            </div>
            <ButtonLink href="/dev/design" className="sm:w-auto">
              {t("common.home")}
            </ButtonLink>
          </MessageCard>
        </Specimen>
      </div>

      <Specimen name="Centred column · SettingsGroup rows">
        <div className={cn(READING_COLUMN, "gap-6")}>
          <SettingsGroup id="gallery-settings" title={t("common.theme")}>
            <LinkRow href="/dev/design" icon="document" label={t("common.privacyPolicy")} />
            <LinkRow href="https://invest.ao" icon="help" label={t("site.legal.supportTitle")} external />
            <ValueRow icon="info" label={t("common.instrument")}>
              BAIAAAAA
            </ValueRow>
            <ControlRow icon="settings" label={t("common.theme")}>
              <ThemeSwitch initial={initialTheme} />
            </ControlRow>
            <DisclosureRow icon="shield-check" label={t("common.privacyPolicy")}>
              <p>{t("designSystem.gallery.sampleInsightMessage")}</p>
            </DisclosureRow>
          </SettingsGroup>
        </div>
      </Specimen>
    </GallerySection>
  );
}
