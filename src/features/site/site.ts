export const APP_STORE_URL = "https://apps.apple.com/app/id6812907673";
export const APP_STORE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";
export const SUPPORT_EMAIL = "suporte@invest.ao";
export const SIGN_IN_PATH = "/entrar";

/**
 * Fixed public pages that search engines may index. The sitemap lists these in both languages, plus every
 * visible instrument, lesson and published article.
 */
export const INDEXABLE_PAGES = {
  home: "/",
  policy: "/policy",
  terms: "/termos",
  support: "/suporte",
  deletion: "/eliminar-conta",
  market: "/mercado",
  news: "/noticias",
  learn: "/aprender",
} as const;

export type IndexablePage = keyof typeof INDEXABLE_PAGES;

/** Each indexable page has a generated Open Graph image; invite links share one generic image. */
export const OG_IMAGES = [...(Object.keys(INDEXABLE_PAGES) as IndexablePage[]), "invite"] as const;
export type OgImage = (typeof OG_IMAGES)[number];
