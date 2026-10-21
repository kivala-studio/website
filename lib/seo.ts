import type { Metadata } from "next";

// Keep canonical, sitemap and structured-data URLs on the production domain.
export const siteUrl = "https://invest.ao";
export const siteName = "Invest.ao";
export const siteTitle = "Invest.ao | Mercado de capitais em Angola";
export const siteDescription =
  "Explora o mercado de capitais angolano. Pesquisa instrumentos, consulta referências de preços BODIVA e lê notícias. Organiza a tua carteira, lista e alertas na invest.ao.";
export const socialImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "invest.ao — Consulta pública do mercado de capitais angolano.",
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
