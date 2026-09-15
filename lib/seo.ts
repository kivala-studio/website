import type { Metadata } from "next";

// Keep canonical, sitemap and structured-data URLs on the production domain.
export const siteUrl = "https://invest.ao";
export const siteName = "Invest.ao";
export const siteTitle = "Invest.ao | Mercado de capitais em Angola";
export const siteDescription =
  "Acompanhe o mercado de capitais em Angola com a Invest.ao. Consulte títulos, compare a evolução dos preços e organize a sua carteira. Em breve para iPhone.";
export const socialImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Invest.ao — Mercado de capitais em Angola. Em breve para iPhone.",
};

export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName,
      locale: "pt_AO",
      type: "website",
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}
