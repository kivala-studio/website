import type { NextConfig } from "next";

import { parseServerEnv } from "./src/config/env";
import { SECURITY_HEADERS } from "./src/config/security";

// Fails `next build`, `next dev` and `next start` with the name of every missing or invalid variable.
parseServerEnv(process.env);

const nextConfig: NextConfig = {
  // Cache Components / Partial Prerendering are off: the nonce-based CSP needs every page rendered per request.
  poweredByHeader: false,
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

export default nextConfig;
