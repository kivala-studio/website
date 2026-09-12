import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Invest.ao — O teu mercado. A tua perspectiva.",
  description: "Acompanha o mercado angolano, organiza a tua carteira e descobre o que importa. Conhece a Invest.ao, em breve para iPhone.",
  openGraph: {
    title: "Invest.ao — O teu mercado. A tua perspectiva.",
    description: "Uma nova perspectiva sobre o mercado angolano. Conhece a aplicação Invest.ao.",
    locale: "pt_AO",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-AO"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
