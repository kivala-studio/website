import { cache } from "react";

import { getPublicArticle } from "@/data/market/public-cache";
import { ARTICLE_SLUG } from "@/domain/news/article";

/** The published article for a slug. `undefined`: not published (404); `null`: the read failed. */
export const article = cache(async (slug: string) => (ARTICLE_SLUG.test(slug) ? getPublicArticle(slug).catch(() => null) : undefined));
