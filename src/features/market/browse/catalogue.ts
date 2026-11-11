import "server-only";

import type { PublicInstrument } from "@/data/market/public";
import { getPublicCatalogue } from "@/data/market/public-cache";
import { isBondKind } from "@/domain/market";
import { civilDate } from "@/domain/market/zone";

import type { CatalogueRow } from "./price-cell";

/** A public instrument as list rows receive it: identity and the dated verified close, as text. */
export function catalogueRow(instrument: PublicInstrument): CatalogueRow {
  const close = instrument.closingPrice;
  return {
    id: instrument.id,
    symbol: instrument.symbol,
    name: instrument.name,
    issuer: instrument.name,
    kind: instrument.kind,
    bond: isBondKind(instrument.kind),
    currency: instrument.currency ?? "AOA",
    close: close && {
      price: close.price.toString(),
      date: civilDate(close.tradingDate),
      change: close.percentageChange?.toString(),
    },
  };
}

/** The cached public catalogue as rows; `null` when it cannot be read. */
export async function catalogueRows(now: number): Promise<CatalogueRow[] | null> {
  try {
    return (await getPublicCatalogue(now)).map(catalogueRow);
  } catch {
    return null;
  }
}
