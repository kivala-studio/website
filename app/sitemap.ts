import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only published canonical pages; omit invented modification dates.
  return [{ url: siteUrl }, { url: `${siteUrl}/mercado` }, { url: `${siteUrl}/noticias` }, { url: `${siteUrl}/policy` }];
}
