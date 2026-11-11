import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getPathname } from "@/i18n/navigation";
import { type AppLocale, routing } from "@/i18n/routing";

import type { OgImage } from "./site";

const OG_LOCALE: Record<AppLocale, string> = { pt: "pt_AO", en: "en_AO" };

type PageMetadataInput = {
  locale: AppLocale;
  /** Route without the locale prefix, e.g. `/policy`. */
  path: string;
  title: string;
  description: string;
  image: OgImage;
  /** A page-specific card (e.g. an article's) in place of the generic `image`. */
  imageURL?: string;
  /** Articles: Open Graph `article` with its publication time (ISO 8601). */
  publishedTime?: string;
  /** Home uses the store name as is, without the ` · invest.ao` suffix. */
  absoluteTitle?: boolean;
  /** Indexable pages get a canonical URL and hreflang alternates; the others are noindex. */
  indexable?: boolean;
};

/** Title, description, canonical, hreflang (pt, en, x-default) and Open Graph / Twitter cards for a public page. */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  image,
  imageURL,
  publishedTime,
  absoluteTitle = false,
  indexable = true,
}: PageMetadataInput): Metadata {
  const url = getPathname({ locale, href: path });
  const images = [{ url: imageURL ?? `/og/${locale}-${image}.png`, width: 1200, height: 630, alt: title }];
  const languages = Object.fromEntries(routing.locales.map((other) => [other, getPathname({ locale: other, href: path })]));

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: indexable ? { canonical: url, languages: { ...languages, "x-default": languages[routing.defaultLocale] } } : undefined,
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: {
      ...(publishedTime ? { type: "article" as const, publishedTime } : { type: "website" as const }),
      siteName: "invest.ao",
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((other) => other !== locale).map((other) => OG_LOCALE[other]),
      url: indexable ? url : undefined,
      title,
      description,
      images,
    },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export type LocaleParams = { params: Promise<{ locale: string }> };
type Translate = Awaited<ReturnType<typeof getTranslations<never>>>;

/** `generateMetadata` for a page: resolves the locale and translations, then builds `pageMetadata`. */
export function siteMetadata(
  page: Omit<PageMetadataInput, "locale" | "title" | "description">,
  copy: (t: Translate) => { title: string; description: string },
) {
  return async ({ params }: LocaleParams): Promise<Metadata> => {
    const locale = (await params).locale as AppLocale;
    const t = await getTranslations({ locale });
    return pageMetadata({ ...page, ...copy(t), locale });
  };
}
