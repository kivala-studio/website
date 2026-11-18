import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
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

/** Mark and wordmark for the top bar; the wordmark gives way on narrow phones (the link keeps its name). */
export function BrandLockup() {
  const t = useTranslations();
  return (
    <>
      <PalancaMark className="size-8" />
      <span className="hidden font-display text-[1.1875rem] font-semibold tracking-tight min-[25rem]:inline">{t("common.appName")}</span>
    </>
  );
}

/** The language link styled as a round top-bar control. */
export const LANGUAGE_CONTROL =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full font-display text-secondary font-semibold text-secondary-text transition-colors hover:bg-action-surface hover:text-primary-text";

/** Public top bar: sections as pills, then the language, the theme and sign-in. Visitors get no search (it needs the app's market store). */
export function SiteHeader({ theme }: { theme: Theme }) {
  const t = useTranslations();
  return (
    <TopBar
      home={{ href: "/", label: t("site.header.homeLabel") }}
      logo={<BrandLockup />}
      navLabel={t("site.header.navLabel")}
      mobileNav="row"
      nav={[
        { href: INDEXABLE_PAGES.market, label: t("common.market") },
        { href: INDEXABLE_PAGES.news, label: t("common.news") },
        { href: INDEXABLE_PAGES.learn, label: t("learn.title") },
      ]}
      actions={
        <>
          <LanguageSwitch className={LANGUAGE_CONTROL} />
          <ThemeMenu initial={theme} />
          <ButtonLink href={SIGN_IN_PATH} prefetch={false} size="compact" className="ml-1">
            {t("onboarding.navigation.signIn")}
          </ButtonLink>
        </>
      }
    />
  );
}

const FOOTER_LINK =
  "inline-flex min-h-11 items-center rounded-small text-secondary text-secondary-text transition-colors hover:text-primary-text desk:min-h-9";
/** The logo row and the column headings share one height, so the columns start on the logo's line. */
const FOOTER_ROW = "flex min-h-11 items-center desk:min-h-9";

/**
 * The brand (logo, then the theme and the language), three link columns on the logo's line, then the standing
 * disclaimers and the copyright under a hairline. `year` is the server's (Luanda) year.
 */
export function SiteFooter({ theme, year }: { theme: Theme; year: string }) {
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
      title: t("common.account"),
      links: [
        { href: SIGN_IN_PATH, title: t("onboarding.navigation.signIn") },
        { href: INDEXABLE_PAGES.deletion, title: t("common.deleteAccount") },
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
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between lg:flex-col lg:items-start lg:justify-start">
            <Link href="/" prefetch={false} aria-label={t("site.header.homeLabel")} className={cn(FOOTER_ROW, "gap-2 rounded-small text-primary-text")}>
              <PalancaMark className="size-8" />
              <span className="font-display text-[1.1875rem] font-semibold tracking-tight">{t("common.appName")}</span>
            </Link>
            <div className="flex w-full max-w-sm items-center gap-2">
              <div className="min-w-0 flex-1">
                <ThemeSwitch initial={theme} />
              </div>
              <LanguageSwitch className={cn(LANGUAGE_CONTROL, "bg-action-surface")} />
            </div>
          </div>
          <nav aria-label={t("site.footer.label")} className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
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
