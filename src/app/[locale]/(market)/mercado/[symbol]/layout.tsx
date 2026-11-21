import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { findInstrument } from "@/features/market/instrument/load";
import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type Props = { children: ReactNode; params: Promise<{ locale: string; symbol: string }> };

/**
 * Settles the symbol above the page's `loading.tsx`, before any of the skeleton streams, so another spelling stays a
 * real redirect and an unknown symbol a real 404. `findInstrument` is cached; the page reads the same lookup.
 */
export default async function InstrumentLayout({ children, params }: Props) {
  const { locale, symbol } = await params;
  const lookup = await findInstrument(symbol);
  if (lookup.kind === "redirect") redirect({ href: `/mercado/${encodeURIComponent(lookup.symbol)}`, locale: locale as AppLocale });
  if (lookup.kind !== "found") notFound();
  return children;
}
