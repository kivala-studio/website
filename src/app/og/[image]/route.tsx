import { getTranslations } from "next-intl/server";

import { ogCard } from "@/features/site/og-card";
import { OG_IMAGES, type OgImage } from "@/features/site/site";
import { type AppLocale, routing } from "@/i18n/routing";

// Open Graph cards (1200 × 630), rendered once at build time for every page and language: /og/pt-home.png …
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => OG_IMAGES.map((image) => ({ image: `${locale}-${image}.png` })));
}

const TITLE_KEYS = {
  home: "common.yourMarketUpClose",
  policy: "common.privacyPolicy",
  terms: "site.legal.termsTitle",
  support: "site.legal.supportTitle",
  deletion: "common.deleteAccount",
  market: "common.market",
  news: "common.news",
  learn: "learn.title",
  invite: "referral.redeem.title",
} as const satisfies Record<OgImage, string>;

export async function GET(_request: Request, { params }: { params: Promise<{ image: string }> }) {
  const [locale, image] = (await params).image.replace(/\.png$/, "").split("-") as [AppLocale, OgImage];
  const t = await getTranslations({ locale });
  return ogCard({ appName: t("common.appName"), title: t(TITLE_KEYS[image]) });
}
