import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { parseServerEnv } from "./src/config/env";
import { SECURITY_HEADERS } from "./src/config/security";

// Fails `next build`, `next dev` and `next start` with the name of every missing or invalid variable.
const env = parseServerEnv(process.env);

const nextConfig: NextConfig = {
  // Cache Components / Partial Prerendering are off: the nonce-based CSP needs every page rendered per request.
  poweredByHeader: false,
  // `*.dev.tsx` routes (the /dev/design gallery) exist only outside production mode.
  pageExtensions: env.dataMode === "production" ? ["tsx", "ts"] : ["dev.tsx", "tsx", "ts"],
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
