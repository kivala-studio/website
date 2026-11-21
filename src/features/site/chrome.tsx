import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { iconButtonClass, TOP_BAR_FLOAT } from "@/ui/components/button-styles";
import { ButtonLink } from "@/ui/components/buttons";
import { ThemeMenu, ThemeSwitch } from "@/ui/components/controls";
import { PAGE_CONTAINER } from "@/ui/components/layout";
import { TopBar } from "@/ui/components/top-bar";
import type { Theme } from "@/ui/theme/theme";

import { LanguageSwitch } from "./language-switch";
import { INDEXABLE_PAGES, SIGN_IN_PATH } from "./site";

/** The palanca-negra mark. A template image used as a mask, so it takes the current text colour in both themes. */
export function PalancaMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 bg-current [mask-image:url(/brand/palanca.png)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
        className,
      )}
    />
  );
}

/** Where the wordmark appears: from 360 px in the public bar (menu, logo, sign-in), from 400 px in the app's fuller bar. */
const WORDMARK_FROM = { 360: "min-[22.5rem]:inline", 400: "min-[25rem]:inline" } as const;

/** Mark and wordmark for the top bar; the wordmark gives way on narrow phones (the link keeps its name). */
export function BrandLockup({ wordmarkFrom = 400 }: { wordmarkFrom?: keyof typeof WORDMARK_FROM }) {
  const t = useTranslations();
  return (
    <>
      <PalancaMark className="size-8" />
      <span className={cn("hidden font-display text-[1.1875rem] font-semibold tracking-tight", WORDMARK_FROM[wordmarkFrom])}>{t("common.appName")}</span>
    </>
  );
}

/** The language link (flag and short code) styled as a 44 px pill; give it a fill for where it sits. */
export const LANGUAGE_CONTROL =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full pr-3 pl-2.5 font-display text-secondary font-semibold text-secondary-text transition-colors hover:text-primary-text";

/**
 * Extra classes for the sign-in pill (`ButtonLink size="compact"`) in the public bar. Below 1024 px the pill is drawn
 * at 36 px with tighter padding so it doesn't outweigh the logo; an `::after` 4 px above and below keeps the 44 px
 * target. From 1024 px it is the plain compact pill.
 */
export const SIGN_IN_PILL =
  "max-lg:relative max-lg:min-h-9 max-lg:px-3 max-lg:after:absolute max-lg:after:inset-x-0 max-lg:after:-inset-y-1";

/** The theme and the language on one row, in the public top bar's menu. */
export function SiteControls({ theme }: { theme: Theme }) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <ThemeSwitch initial={theme} />
      </div>
      <LanguageSwitch className={cn(LANGUAGE_CONTROL, "bg-accent-soft hover:bg-accent-soft-hover")} />
    </div>
  );
}

/**
 * Public top bar: the logo, the sections in the centred capsule, then the language, the theme and sign-in. Below
 * 1024 px the sections, the theme and the language move into the menu, whose round button ends the bar after the
 * smaller sign-in pill.
 * Visitors get no search (it needs the app's market store).
 */
export function SiteHeader({ theme }: { theme: Theme }) {
  const t = useTranslations();
  return (
    <TopBar
      home={{ href: "/", label: t("site.header.homeLabel") }}
      logo={<BrandLockup wordmarkFrom={360} />}
      navLabel={t("site.header.navLabel")}
      mobileNav="menu"
      menu={{ label: t("site.header.menuLabel"), content: <SiteControls theme={theme} /> }}
      nav={[
        { href: INDEXABLE_PAGES.market, label: t("common.market") },
        { href: INDEXABLE_PAGES.news, label: t("common.news") },
        { href: INDEXABLE_PAGES.learn, label: t("learn.title") },
      ]}
      wideActions={
        <>
          <LanguageSwitch className={cn(LANGUAGE_CONTROL, TOP_BAR_FLOAT, "bg-card-background hover:bg-accent-soft")} />
          <ThemeMenu initial={theme} triggerClassName={iconButtonClass("surface", TOP_BAR_FLOAT)} />
        </>
      }
      actions={
        <ButtonLink href={SIGN_IN_PATH} prefetch={false} size="compact" className={cn(TOP_BAR_FLOAT, SIGN_IN_PILL)}>
          {t("onboarding.navigation.signIn")}
        </ButtonLink>
      }
    />
  );
}

const FOOTER_LINK =
  "inline-flex min-h-11 items-center rounded-small text-secondary text-secondary-text transition-colors hover:text-primary-text desk:min-h-9";
/** The logo row and the column headings share one height, so the columns start on the logo's line. */
const FOOTER_ROW = "flex min-h-11 items-center desk:min-h-9";

/**
 * The logo, then the product and legal link columns on the logo's line; then the standing disclaimers and the
 * copyright under a hairline. One grid of equal tracks: on phones the logo sits above the two columns; from 640 px
 * the three share a row; from 1024 px the logo takes three of five tracks and the links the last two. `year` is the
 * server's (Luanda) year.
 */
export function SiteFooter({ year }: { year: string }) {
  const t = useTranslations();
  const columns = [
    {
      title: t("site.footer.product"),
      links: [
        { href: INDEXABLE_PAGES.market, title: t("common.market") },
        { href: INDEXABLE_PAGES.news, title: t("common.news") },
        { href: INDEXABLE_PAGES.learn, title: t("learn.title") },
        { href: "/simulador", title: t("common.simulateInvestment") },
      ],
    },
    {
      title: t("site.footer.legal"),
      links: [
        { href: INDEXABLE_PAGES.policy, title: t("common.privacyPolicy") },
        { href: INDEXABLE_PAGES.terms, title: t("site.legal.termsTitle") },
        { href: INDEXABLE_PAGES.support, title: t("site.legal.supportTitle") },
      ],
    },
  ];
  return (
    <footer className="mt-auto">
      <div className={cn(PAGE_CONTAINER, "flex flex-col gap-8 border-t border-hairline pt-8 pb-8 md:gap-10 md:pt-12 md:pb-10")}>
        <div className="grid gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          <Link
            href="/"
            prefetch={false}
            aria-label={t("site.header.homeLabel")}
            className={cn(FOOTER_ROW, "gap-2 self-start justify-self-start rounded-small text-primary-text lg:col-span-3")}
          >
            <PalancaMark className="size-8" />
            <span className="font-display text-[1.1875rem] font-semibold tracking-tight">{t("common.appName")}</span>
          </Link>
          <nav aria-label={t("site.footer.label")} className="grid grid-cols-2 gap-x-6 sm:col-span-2">
            {columns.map((column) => (
              <div key={column.title} className="flex min-w-0 flex-col">
                <h2 className={cn(FOOTER_ROW, "text-secondary font-semibold text-primary-text")}>{column.title}</h2>
                <ul className="flex flex-col">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} prefetch={false} className={FOOTER_LINK}>
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-4 border-t border-hairline pt-6 text-caption md:pt-8">
          <div className="flex max-w-2xl flex-col gap-1.5 text-tertiary-text">
            <p>{t("site.footer.independence")}</p>
            <p>{t("settings.marketData.disclaimer")}</p>
            <p>{t("onboarding.caption.simulationDisclaimer")}</p>
          </div>
          <p className="text-secondary-text">{`© ${year} ${t("common.appName")}`}</p>
        </div>
      </div>
    </footer>
  );
}
