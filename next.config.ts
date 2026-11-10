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
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS] }];
  },
};

export default createNextIntlPlugin()(nextConfig);
