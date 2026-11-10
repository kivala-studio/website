import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";

import { publicEnv } from "@/config/public-env";
import { buildContentSecurityPolicy } from "@/config/security";
import { routing } from "@/i18n/routing";

const handleLocale = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = buildContentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    secure: request.nextUrl.protocol === "https:",
    supabaseUrl: publicEnv.supabaseUrl,
    sentryDsn: publicEnv.sentryDsn,
  });

  // next-intl forwards these request headers, so Next.js can read the nonce while rendering.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);

  const response = handleLocale(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next|_vercel|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
