import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { requestTime } from "@/data/clock";
import { readListingEvent } from "@/data/market/listing";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type Props = { children: ReactNode; params: Promise<{ locale: string; event: string }> };

/**
 * Settles the admission above the page's `loading.tsx`, before any of the skeleton streams, so an unknown one stays a
 * real 404 and a listed one a real redirect to its instrument. Both reads are cached; the page makes the same ones.
 */
export default async function ListingLayout({ children, params }: Props) {
  const { locale, event: id } = await params;
  const now = requestTime();
  const event = await readListingEvent(id, now);
  if (!event) notFound();
  if (event.status === "confirmed" && event.securityID) {
    const listed = (await catalogueRows(now))?.find((row) => row.id === event.securityID);
    if (listed) redirect({ href: `/mercado/${encodeURIComponent(listed.symbol)}`, locale: locale as AppLocale });
  }
  return children;
}
