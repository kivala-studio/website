import type { MetadataRoute } from "next";

import { serverEnv } from "@/config/server-env";
import { INDEXABLE_PAGES } from "@/features/site/site";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** Public, indexable pages only, each in both languages with its hreflang alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  const absolute = (locale: (typeof routing.locales)[number], path: string) =>
    `${serverEnv.siteUrl}${getPathname({ locale, href: path })}`;

  return Object.values(INDEXABLE_PAGES).flatMap((path) => {
    const languages = Object.fromEntries(routing.locales.map((locale) => [locale, absolute(locale, path)]));
    return routing.locales.map((locale) => ({
      url: absolute(locale, path),
      changeFrequency: path === INDEXABLE_PAGES.home ? ("weekly" as const) : ("monthly" as const),
      priority: path === INDEXABLE_PAGES.home ? 1 : 0.5,
      alternates: { languages },
    }));
  });
}
