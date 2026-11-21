import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { parseServerEnv } from "./src/config/env";
import { SECURITY_HEADERS } from "./src/config/security";

// Fails `next build`, `next dev` and `next start` with the name of every missing or invalid variable.
const env = parseServerEnv(process.env);

const nextConfig: NextConfig = {
  // Cache Components / Partial Prerendering are off: the nonce-based CSP needs every page rendered per request.
  poweredByHeader: false,
  experimental: {
    // A page visited in the last 30 s is shown again from the tab's client cache, without a server request. Current
    // quotes come from the tab's market store either way; the server-rendered rest (dated closes, news) may be that old.
    staleTimes: { dynamic: 30 },
  },
  // `*.dev.tsx` routes (the /dev/design gallery) exist only outside production mode; `*.local.ts` routes (the
  // password sign-in for the seeded development accounts) only in `local` mode.
  pageExtensions: [
    ...(env.dataMode === "local" ? ["local.ts"] : []),
    ...(env.dataMode === "production" ? [] : ["dev.tsx"]),
    "tsx",
    "ts",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    // Share links carry a bearer token in the path: never sent on as a referrer, never stored by a cache.
    const share = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "no-store" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    return [
      { source: "/:path*", headers: [...SECURITY_HEADERS] },
      { source: "/partilha/:token", headers: share },
      { source: "/en/partilha/:token", headers: share },
    ];
  },
};

export default createNextIntlPlugin()(nextConfig);
