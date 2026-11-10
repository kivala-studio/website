import type { Metadata } from "next";

import { getPublicCatalogue } from "@/data/market/public-cache";
import { isBondKind } from "@/domain/market";
import { type DevInstrument, MarketDevView } from "@/features/market/market-dev-view";

// Development view of the data layer: built only outside production mode (see pageExtensions in
// next.config.ts). The server renders the cached catalogue with dated closes; current quotes are
// added in the browser by the market store. Demo mode reads `?scenario=`.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MarketDevPage({ searchParams }: { searchParams: Promise<{ scenario?: string | string[] }> }) {
  const { scenario } = await searchParams;
  const instruments: DevInstrument[] = (await getPublicCatalogue()).map((instrument) => ({
    id: instrument.id,
    symbol: instrument.symbol,
    name: instrument.name,
    close: instrument.closingPrice?.price.toString() ?? null,
    bond: isBondKind(instrument.kind),
  }));
  return <MarketDevView instruments={instruments} scenario={typeof scenario === "string" ? scenario : undefined} />;
}
