"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** Links the same page in the other language. */
export function LanguageSwitch({ className }: { className?: string }) {
  const t = useTranslations("site.header");
  const locale = useLocale();
  const pathname = usePathname();
  const other = routing.locales.find((candidate) => candidate !== locale) ?? routing.defaultLocale;
  return (
    <Link href={pathname} prefetch={false} locale={other} hrefLang={other} lang={other} className={className}>
      {/* The short code fits a 320 px header; assistive technology reads the language name. */}
      <span aria-hidden>{t("languageCode")}</span>
      <span className="sr-only">{t("languageName")}</span>
    </Link>
  );
}
