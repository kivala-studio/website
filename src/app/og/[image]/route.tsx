import { readFile } from "node:fs/promises";
import path from "node:path";

import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";

import { OG_IMAGES, type OgImage } from "@/features/site/site";
import { type AppLocale, routing } from "@/i18n/routing";

// Open Graph cards (1200 × 630), rendered once at build time for every page and language: /og/pt-home.png …
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => OG_IMAGES.map((image) => ({ image: `${locale}-${image}.png` })));
}

// Light tokens from src/ui/theme/tokens.css (the brand's default canvas for shared images).
const CANVAS = "#f2f3f5";
const PRIMARY_TEXT = "#182231";
const ACCENT = "#1854c5";
const CHART_GRID = "#cbd2dc";

const TITLE_KEYS = {
  home: "common.yourMarketUpClose",
  policy: "common.privacyPolicy",
  terms: "site.legal.termsTitle",
  support: "site.legal.supportTitle",
  deletion: "common.deleteAccount",
  invite: "referral.redeem.title",
} as const satisfies Record<OgImage, string>;

const palanca = readFile(path.join(process.cwd(), "public/brand/palanca.png")).then(
  (data) => `data:image/png;base64,${data.toString("base64")}`,
);

export async function GET(_request: Request, { params }: { params: Promise<{ image: string }> }) {
  const [locale, image] = (await params).image.replace(/\.png$/, "").split("-") as [AppLocale, OgImage];
  const t = await getTranslations({ locale });
  const title = t(TITLE_KEYS[image]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: CANVAS,
          color: PRIMARY_TEXT,
          position: "relative",
        }}
      >
        <svg width="1200" height="260" viewBox="0 0 1200 260" style={{ position: "absolute", left: 0, bottom: 0 }}>
          <line x1="0" y1="80" x2="1200" y2="80" stroke={CHART_GRID} strokeWidth="1" />
          <line x1="0" y1="170" x2="1200" y2="170" stroke={CHART_GRID} strokeWidth="1" />
          <path
            d="M0 230 L120 222 L240 226 L360 204 L480 208 L600 182 L720 188 L840 150 L960 156 L1080 112 L1200 96"
            fill="none"
            stroke={ACCENT}
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </svg>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori into a PNG, not the DOM. */}
          <img src={await palanca} width={72} height={72} alt="" />
          <span style={{ fontSize: 40, letterSpacing: 1 }}>{t("common.appName")}</span>
        </div>
        <div style={{ display: "flex", fontSize: 76, lineHeight: 1.1, letterSpacing: -2, maxWidth: 980, marginBottom: 170 }}>
          {title}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
