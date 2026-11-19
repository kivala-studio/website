"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { BrandLockup, LANGUAGE_CONTROL, SIGN_IN_PILL, SiteControls } from "@/features/site/chrome";
import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { ButtonLink, iconButtonClass } from "@/ui/components/buttons";
import { FilterTabs, NavTabs, SearchField, SectionTabs, ThemeMenu } from "@/ui/components/controls";
import { Card } from "@/ui/components/layout";
import { Menu } from "@/ui/components/menu";
import { RAIL_TILE, RAIL_TILE_IDLE, SectionRail } from "@/ui/components/section-rail";
import { SeeAll } from "@/ui/components/see-all";
import { TopBar } from "@/ui/components/top-bar";
import { LanguageFlag } from "@/ui/icons/flags";
import { Icon } from "@/ui/icons/icon";
import type { Theme } from "@/ui/theme/theme";

import { GallerySection, SPECIMEN_GRID, Specimen, Variant } from "./specimen";

const HERE = "/dev/design";

export function Navigation({ initialTheme }: { initialTheme: Theme }) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState<"all" | "results" | "news">("all");
  const [book, setBook] = useState<"combined" | "main">("combined");
  const tabs = [t("assetDetails.tab.overview"), t("common.about"), t("assetDetails.tab.orders")];

  return (
    <GallerySection id="navigation" title="Navigation">
      <Specimen name='TopBar mobileNav="menu" (public site)'>
        {/* No clipping here, so the menu can open below the sample at phone widths. */}
        <div className="rounded-large border border-hairline [&>header]:rounded-large">
          <TopBar
            home={{ href: HERE, label: t("site.header.homeLabel") }}
            logo={<BrandLockup wordmarkFrom={360} />}
            navLabel="Site sample"
            mobileNav="menu"
            menu={{ label: t("site.header.menuLabel"), content: <SiteControls theme={initialTheme} /> }}
            nav={[
              { href: HERE, label: t("common.market") },
              { href: "/noticias", label: t("common.news") },
              { href: "/aprender", label: t("learn.title") },
            ]}
            wideActions={
              <>
                <span className={LANGUAGE_CONTROL}>
                  <LanguageFlag locale="en" />
                  EN
                </span>
                <ThemeMenu initial={initialTheme} />
              </>
            }
            actions={
              <ButtonLink href={HERE} size="compact" className={SIGN_IN_PILL}>
                {t("onboarding.navigation.signIn")}
              </ButtonLink>
            }
          />
        </div>
      </Specimen>

      <Specimen name="LANGUAGE_CONTROL · LanguageFlag">
        <div className="flex flex-wrap items-center gap-4">
          <Variant label='Bar, pt page: locale="en"'>
            <span className={LANGUAGE_CONTROL}>
              <LanguageFlag locale="en" />
              EN
            </span>
          </Variant>
          <Variant label='Menu, en page: locale="pt"'>
            <span className={cn(LANGUAGE_CONTROL, "bg-action-surface")}>
              <LanguageFlag locale="pt" />
              PT
            </span>
          </Variant>
        </div>
      </Specimen>

      <Specimen name='TopBar mobileNav="none" (signed-in app)'>
        <div className="isolate overflow-hidden rounded-large border border-hairline">
          <TopBar
            home={{ href: HERE, label: t("site.header.homeLabel") }}
            logo={<BrandLockup />}
            navLabel="App sample"
            mobileNav="none"
            nav={[
              { href: "/inicio", label: t("common.home") },
              { href: HERE, label: t("common.explore") },
              { href: "/carteira", label: t("common.portfolio") },
              { href: "/lista", label: t("common.watchlistTab") },
            ]}
            search={
              <span className="hidden w-full lg:block">
                <SearchField value={query} onChange={setQuery} placeholder={t("common.search")} hint="/" />
              </span>
            }
            actions={
              <>
                <Link href={HERE} className={iconButtonClass("plain")}>
                  <Icon name="chart" label={t("unusualActivity.title")} scale="l" />
                </Link>
                <Link href={HERE} aria-current="page" className={iconButtonClass("plain", "aria-[current=page]:bg-action-surface")}>
                  <Icon name="notification" label={t("common.activity")} scale="l" />
                  <span aria-hidden className="absolute top-2 right-2 size-2.5 rounded-full bg-negative ring-2 ring-elevated-background" />
                </Link>
                <span aria-hidden className="ml-1 inline-flex size-9 items-center justify-center rounded-full bg-accent-soft font-display text-secondary font-semibold text-accent">
                  AB
                </span>
              </>
            }
          />
        </div>
      </Specimen>

      <Specimen name="SectionRail leading={switcher tile}">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-8">
          <SectionRail
            label="Rail sample"
            leading={
              <Menu
                label={t("portfolioBooks.title")}
                align="start"
                className="w-full"
                triggerClassName={cn(RAIL_TILE, RAIL_TILE_IDLE, "motion-press border border-hairline text-primary-text")}
                trigger={
                  <>
                    <Icon name="wallet" scale="l" className="text-accent" />
                    <span className="flex max-w-full items-center gap-0.5 font-display leading-tight">
                      <span className="sr-only">{t("portfolioBooks.title")}: </span>
                      <span className="truncate">{t(book === "combined" ? "portfolioBooks.combined" : "portfolioBooks.main")}</span>
                      <Icon name="chevron-down" scale="s" className="shrink-0 text-secondary-text" />
                    </span>
                  </>
                }
                entries={[
                  { kind: "check", label: t("portfolioBooks.combined"), checked: book === "combined", onToggle: () => setBook("combined") },
                  { kind: "check", label: t("portfolioBooks.main"), checked: book === "main", onToggle: () => setBook("main") },
                ]}
              />
            }
            items={[
              { href: HERE, label: t("assetDetails.tab.overview"), icon: "portfolio", current: "page" },
              { href: "/carteira/registos", label: t("common.records"), icon: "history" },
              { href: "/carteira/rendimentos", label: t("income.title"), icon: "dividend" },
            ]}
          />
          <Card className="min-h-40">
            <p className="text-body text-secondary-text">{t("designSystem.gallery.sampleInsightMessage")}</p>
          </Card>
        </div>
      </Specimen>

      <div className={SPECIMEN_GRID}>
        <Specimen name="SectionTabs (panels in place)">
          <SectionTabs label={t("common.security")} titles={tabs} selected={tab} onSelect={setTab} idPrefix="gallery-tabs" />
          {tabs.map((title, index) => (
            <div key={title} role="tabpanel" id={`gallery-tabs-panel-${index}`} aria-labelledby={`gallery-tabs-tab-${index}`} hidden={index !== tab}>
              <p className="text-body text-secondary-text">{title}</p>
            </div>
          ))}
        </Specimen>

        <Specimen name="NavTabs (links, aria-current)">
          <NavTabs
            label="Page tabs sample"
            items={[
              { href: HERE, title: t("assetDetails.tab.overview"), exact: true },
              { href: "/carteira/registos", title: t("common.records") },
              { href: "/carteira/rendimentos", title: t("income.title") },
            ]}
          />
          <Variant label="URL filters: current={…}" className="items-stretch">
            <NavTabs
              label="Filter links sample"
              items={[
                { href: HERE, title: t("common.all"), current: true },
                { href: HERE, title: t("common.stocks"), current: false },
                { href: HERE, title: t("common.bonds"), current: false },
              ]}
            />
          </Variant>
        </Specimen>
      </div>

      <div className={SPECIMEN_GRID}>
        <Specimen name="FilterTabs (aria-pressed)">
          <FilterTabs
            label="Filter sample"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", title: t("common.all") },
              { value: "results", title: t("designSystem.gallery.valuesHeader") },
              { value: "news", title: t("common.news") },
            ]}
          />
        </Specimen>

        <Specimen name="SeeAll">
          <SeeAll href={HERE} />
        </Specimen>
      </div>
    </GallerySection>
  );
}
