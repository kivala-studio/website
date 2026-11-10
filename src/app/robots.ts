import type { MetadataRoute } from "next";

import { serverEnv } from "@/config/server-env";

export default function robots(): MetadataRoute.Robots {
  return {
    // Invite links and 404s are crawlable but carry noindex; route handlers and the dev gallery are never crawled.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dev/", "/en/dev/"] },
    sitemap: `${serverEnv.siteUrl}/sitemap.xml`,
  };
}
