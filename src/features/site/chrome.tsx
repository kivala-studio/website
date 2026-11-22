import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { iconButtonClass, TOP_BAR_FLOAT } from "@/ui/components/button-styles";
import { ButtonLink } from "@/ui/components/buttons";
import { ThemeMenu, ThemeSwitch } from "@/ui/components/controls";
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
 * (sign-in, or `dashboard`, the app's Início, when signed in). Below 1024 px the sections, the theme and the language move into the
 * menu, whose round button ends the bar after the smaller account pill.
 * Visitors get no search (it needs the app's market store). `plus={false}` leaves Plus out (see `SiteFrame`).
 */
export function SiteHeader({ theme, plus, dashboard }: { theme: Theme; plus: boolean; dashboard?: string }) {
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
        ...(plus ? [{ href: INDEXABLE_PAGES.plus, label: t("site.plus.nav") }] : []),
      ]}
      wideActions={
        <>
          <LanguageSwitch className={cn(LANGUAGE_CONTROL, TOP_BAR_FLOAT, "bg-card-background hover:bg-accent-soft")} />
          <ThemeMenu initial={theme} triggerClassName={iconButtonClass("surface", TOP_BAR_FLOAT)} />
        </>
      }
      actions={
        <ButtonLink href={dashboard ?? SIGN_IN_PATH} size="compact" className={cn(TOP_BAR_FLOAT, SIGN_IN_PILL)}>
          {dashboard ? t("site.header.dashboard") : t("onboarding.navigation.signIn")}
        </ButtonLink>
      }
    />
  );
}

/** A link of the footer card's columns: plain text, the accent on hover; at least 44 px tall, with room above and below when it wraps on phones. */
const FOOTER_LINK =
  "inline-flex min-h-11 items-center rounded-small py-2 text-body leading-snug text-primary-text transition-colors hover:text-accent";

/** One link column of the footer card, under its muted title. */
function FooterColumn({ label, title, links }: { label: string; title: string; links: readonly { href: string; title: string }[] }) {
  return (
    <nav aria-label={label} className="flex min-w-0 flex-col gap-2 sm:min-w-40 lg:min-w-56">
      <h2 className="text-caption font-medium text-secondary-text">{title}</h2>
      <ul className="flex flex-col">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} prefetch="intent" className={FOOTER_LINK}>
              {link.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The footer owns its band, `stage-brand`, so it closes every public page the same way (on the landing it continues
 * the closing section). On it, inset from the window's edges on every side: one big card on the card fill, with the
 * mark at the top left and the copyright at the bottom left, and the legal and product columns on the right. On
 * phones the columns sit side by side under the mark and the copyright closes the card. `year` is the server's
 * (Luanda) year; `plus={false}` leaves Plus out of the product links (see `SiteFrame`).
 */
export function SiteFooter({ year, plus }: { year: string; plus: boolean }) {
  const t = useTranslations();
  const product = [
    { href: INDEXABLE_PAGES.market, title: t("common.market") },
    { href: INDEXABLE_PAGES.news, title: t("common.news") },
    { href: INDEXABLE_PAGES.learn, title: t("learn.title") },
    { href: "/simulador", title: t("common.simulateInvestment") },
    ...(plus ? [{ href: INDEXABLE_PAGES.plus, title: t("site.plus.nav") }] : []),
  ];
  const legal = [
    { href: INDEXABLE_PAGES.policy, title: t("common.privacyPolicy") },
    { href: INDEXABLE_PAGES.terms, title: t("site.legal.termsTitle") },
    { href: INDEXABLE_PAGES.support, title: t("site.legal.supportTitle") },
  ];
  return (
    <footer className="mt-auto bg-stage-brand p-2 sm:p-4 lg:p-6">
      <div className="grid gap-x-10 gap-y-10 rounded-card bg-card-background px-5 py-8 text-primary-text sm:grid-cols-[minmax(0,1fr)_auto] sm:grid-rows-[auto_1fr] sm:p-10 lg:min-h-96 lg:p-14">
        <Link href="/" prefetch="intent" aria-label={t("site.header.homeLabel")} className="inline-flex min-h-12 items-center gap-2.5 self-start justify-self-start rounded-small">
          <PalancaMark className="size-11" />
          <span className="font-display text-[1.5rem] font-semibold tracking-tight">{t("common.appName")}</span>
        </Link>
        <div className="grid grid-cols-2 gap-x-6 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:gap-x-10">
          <FooterColumn label={t("site.footer.legal")} title={t("site.footer.legal")} links={legal} />
          <FooterColumn label={t("site.footer.label")} title={t("site.footer.product")} links={product} />
        </div>
        <p className="text-secondary text-secondary-text sm:col-start-1 sm:row-start-2 sm:self-end">{`© ${year} ${t("common.appName")}`}</p>
      </div>
    </footer>
  );
}
