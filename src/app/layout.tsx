import type { Metadata, Viewport } from "next";
import { connection } from "next/server";

import "./globals.css";

export const metadata: Metadata = {
  title: "invest.ao",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d0f" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Per-request rendering so Next.js can apply the CSP nonce from src/proxy.ts.
  await connection();

  return (
    <html lang="pt-AO" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
