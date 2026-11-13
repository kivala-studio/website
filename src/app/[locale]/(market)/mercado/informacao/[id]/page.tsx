import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MarketUpdateDetail } from "@/features/news/market-information";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("common.marketInformation"), robots: { index: false } };
}

/** One market update (iOS `MarketUpdateDetailView`); its content comes from the tab's market snapshot. */
export default async function MarketUpdatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl">
      <MarketUpdateDetail id={decodeURIComponent(id)} />
    </div>
  );
}
