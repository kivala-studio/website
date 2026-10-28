import type { Metadata } from "next";
import { siteDescription, siteName, siteTitle, siteUrl } from "../lib/seo";
import "./globals.css";
import "./workspace.css";
import "./browse.css";
import "./design-system.css";
import { AccountProvider } from "./components/account-provider";
import { PersonalisationProvider } from "./components/personalisation-provider";
import { connection } from "next/server";
import { AppDownloadProvider } from "./components/app-download";
import { appDistribution } from "../lib/app-distribution";
import { CookieConsentProvider } from "./components/cookie-consent";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: siteTitle,
  description: siteDescription,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // Public ownership proof supplied by Google Search Console for invest.ao.
  verification: { google: "MqYaNrOBpjV0IM7w-0X5W2rO-GK4hY_wjn3d3Ko93ig" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const config =
    url && key?.startsWith("sb_publishable_") ? { url, key } : null;
  return (
    <html
      data-scroll-behavior="smooth"
      lang="pt-AO"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        {/* Apply the browser-local choice before any themed content paints. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const theme=localStorage.getItem("investao.appearance");if(["system","light","dark"].includes(theme))document.documentElement.dataset.theme=theme}catch{}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <CookieConsentProvider>
          <AccountProvider config={config}>
            <PersonalisationProvider>
              <AppDownloadProvider distribution={appDistribution()}>
                {children}
              </AppDownloadProvider>
            </PersonalisationProvider>
          </AccountProvider>
        </CookieConsentProvider>
      </body>
    </html>
  );
}
