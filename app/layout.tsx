import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { siteDescription, siteName, siteTitle, siteUrl } from "../lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-AO" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
