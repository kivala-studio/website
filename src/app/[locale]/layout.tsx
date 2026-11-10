import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { maintenanceActive } from "@/data/flags/maintenance-gate";
import { MaintenanceScreen } from "@/features/maintenance/maintenance-screen";
import { routing } from "@/i18n/routing";
import { parseTheme, THEME_COOKIE } from "@/ui/theme/theme";

import "../globals.css";

export const metadata: Metadata = {
  title: "invest.ao",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3f5" },
    { media: "(prefers-color-scheme: dark)", color: "#090b0f" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ locale: string }> }>) {
  // Per-request rendering so Next.js can apply the CSP nonce from src/proxy.ts.
  await connection();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // The theme is rendered on the server from a cookie, so the page never flashes the wrong theme.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html lang={locale === "pt" ? "pt-AO" : "en-AO"} data-theme={theme} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>{maintenanceActive() ? <MaintenanceScreen /> : children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
