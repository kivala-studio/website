import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { iconButtonClass, TOP_BAR_FLOAT } from "@/ui/components/button-styles";
import { ButtonLink } from "@/ui/components/buttons";
import { ThemeMenu, ThemeSwitch } from "@/ui/components/controls";
import { TopBar } from "@/ui/components/top-bar";
import type { Theme } from "@/ui/theme/theme";

import { LanguageSwitch } from "./language-switch";
import { DASHBOARD_PATH, INDEXABLE_PAGES, SIGN_IN_PATH } from "./site";

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
 * Extra classes for the account pill (`ButtonLink size="compact"`: sign-in, or the dashboard when signed in) in the
 * public bar. Below 1024 px it is 48 px tall, the height of the logo and the round menu button beside it, so the bar's
 * pieces line up as one row. From 1024 px it is the plain compact pill.
 */
export const SIGN_IN_PILL = "max-lg:min-h-12";

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
 * Public top bar: the logo, the sections in the centred capsule, then the language, the theme and the account pill
 * (sign-in, or the dashboard when `signedIn`). Below 1024 px the sections, the theme and the language move into the
 * menu, whose round button ends the bar after the smaller account pill.
 * Visitors get no search (it needs the app's market store).
 */
export function SiteHeader({ theme, signedIn = false }: { theme: Theme; signedIn?: boolean }) {
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
        <ButtonLink href={signedIn ? DASHBOARD_PATH : SIGN_IN_PATH} size="compact" className={cn(TOP_BAR_FLOAT, SIGN_IN_PILL)}>
          {signedIn ? t("site.header.dashboard") : t("onboarding.navigation.signIn")}
        </ButtonLink>
      }
    />
  );
}

/** A link of the footer card's column: plain text, the accent on hover; 44 px tall. */
const FOOTER_LINK = "inline-flex min-h-11 items-center rounded-small text-body text-primary-text transition-colors hover:text-accent";
/** A legal link on the footer band, under the card, in the band's on-colour. */
const FOOTER_LEGAL_LINK = "inline-flex min-h-11 items-center rounded-small underline-offset-4 hover:underline";

/**
 * The footer owns its band, `stage-brand`, so it closes every public page the same way (on the landing it continues
 * the closing section). On it: one big card on the card fill, inset from the window's edges, with the mark at the top
 * left and the product links on the right (one column under its muted title); under the card, one line in the band's on-colour with the copyright on the left
 * and the legal links on the right. `year` is the server's (Luanda) year.
 */
export function SiteFooter({ year }: { year: string }) {
  const t = useTranslations();
  const product = [
    { href: INDEXABLE_PAGES.market, title: t("common.market") },
    { href: INDEXABLE_PAGES.news, title: t("common.news") },
    { href: INDEXABLE_PAGES.learn, title: t("learn.title") },
    { href: "/simulador", title: t("common.simulateInvestment") },
  ];
  const legal = [
    { href: INDEXABLE_PAGES.policy, title: t("common.privacyPolicy") },
    { href: INDEXABLE_PAGES.terms, title: t("site.legal.termsTitle") },
    { href: INDEXABLE_PAGES.support, title: t("site.legal.supportTitle") },
  ];
  return (
    <footer className="mt-auto bg-stage-brand px-2 pt-2 text-on-stage-brand [--focus-ring:var(--on-stage-brand)] sm:px-4 sm:pt-4 lg:px-6 lg:pt-6">
      {/* The card's controls ring in the accent again. */}
      <div className="grid gap-x-10 gap-y-10 rounded-card bg-card-background px-5 py-8 text-primary-text [--focus-ring:var(--accent)] sm:grid-cols-[minmax(0,1fr)_auto] sm:p-10 lg:min-h-96 lg:p-14">
        <Link href="/" prefetch="intent" aria-label={t("site.header.homeLabel")} className="inline-flex min-h-12 items-center gap-2.5 self-start justify-self-start rounded-small">
          <PalancaMark className="size-11" />
          <span className="font-display text-[1.5rem] font-semibold tracking-tight">{t("common.appName")}</span>
        </Link>
        <nav aria-label={t("site.footer.label")} className="flex min-w-40 flex-col gap-2 lg:min-w-56">
          <h2 className="text-caption font-medium text-secondary-text">{t("site.footer.product")}</h2>
          <ul className="flex flex-col">
            {product.map((link) => (
              <li key={link.href}>
                <Link href={link.href} prefetch="intent" className={FOOTER_LINK}>
                  {link.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="flex flex-col-reverse gap-x-8 gap-y-1 px-3 py-4 text-secondary sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="py-3 sm:py-0">{`© ${year} ${t("common.appName")}`}</p>
        <nav aria-label={t("site.footer.legal")}>
          <ul className="flex flex-wrap gap-x-6">
            {legal.map((link) => (
              <li key={link.href}>
                <Link href={link.href} prefetch="intent" className={FOOTER_LEGAL_LINK}>
                  {link.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
