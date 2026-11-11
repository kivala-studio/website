import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { ThemeSwitch } from "@/ui/components/controls";
import type { Theme } from "@/ui/theme/theme";

import { LanguageSwitch } from "./language-switch";
import { SectionLink } from "./section-link";
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

export const PAGE_WIDTH = "mx-auto w-full max-w-6xl px-4 sm:px-6";
// Site links do not prefetch: the pages are light, and on mobile prefetches compete with the first paint.
const NAV_LINK = "inline-flex min-h-11 items-center rounded-small px-3 text-secondary font-semibold";

export function SiteHeader() {
  const t = useTranslations();
  const sections = [
    { href: INDEXABLE_PAGES.market, title: t("common.market") },
    { href: INDEXABLE_PAGES.news, title: t("common.news") },
    { href: INDEXABLE_PAGES.learn, title: t("learn.title") },
  ];
  return (
    <header className={cn(PAGE_WIDTH, "flex flex-wrap items-center justify-between gap-x-2 py-3")}>
      <Link href="/" prefetch={false} aria-label={t("site.header.homeLabel")} className="-ml-1 inline-flex min-h-11 items-center gap-2 rounded-small px-1 text-primary-text">
        <PalancaMark className="size-8" />
        <span className="text-body font-semibold tracking-wide">{t("common.appName")}</span>
      </Link>
      {/* Below `md` the sections take a row of their own under the logo. */}
      <nav aria-label={t("site.header.navLabel")} className="order-last -ml-3 w-full md:order-none md:ml-4 md:w-auto md:flex-1">
        <ul className="flex flex-wrap">
          {sections.map((section) => (
            <li key={section.href}>
              <SectionLink href={section.href} className={NAV_LINK}>
                {section.title}
              </SectionLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="-mr-3 flex items-center">
        <LanguageSwitch className={cn(NAV_LINK, "text-secondary-text")} />
        <Link href={SIGN_IN_PATH} prefetch={false} className={cn(NAV_LINK, "text-accent")}>
          {t("onboarding.navigation.signIn")}
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter({ theme }: { theme: Theme }) {
  const t = useTranslations();
  const links = [
    { href: INDEXABLE_PAGES.policy, title: t("common.privacyPolicy") },
    { href: INDEXABLE_PAGES.terms, title: t("site.legal.termsTitle") },
    { href: INDEXABLE_PAGES.support, title: t("site.legal.supportTitle") },
    { href: INDEXABLE_PAGES.deletion, title: t("common.deleteAccount") },
  ];
  return (
    <footer className="mt-auto border-t border-separator">
      <div className={cn(PAGE_WIDTH, "flex flex-col gap-8 py-10")}>
        <nav aria-label={t("site.footer.label")}>
          <ul className="-ml-3 flex flex-wrap gap-x-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} prefetch={false} className={cn(NAV_LINK, "text-primary-text")}>
                  {link.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex max-w-3xl flex-col gap-2 text-caption text-secondary-text">
          <p>{t("site.footer.independence")}</p>
          <p>{t("settings.marketData.disclaimer")}</p>
          <p>{t("onboarding.caption.simulationDisclaimer")}</p>
        </div>
        <div className="w-full max-w-xs">
          <ThemeSwitch initial={theme} />
        </div>
      </div>
    </footer>
  );
}
