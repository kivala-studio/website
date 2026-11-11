import "server-only";

import { cache } from "react";

import type { PublicInstrument } from "@/data/market/public";
import { getPublicCatalogue } from "@/data/market/public-cache";
import { isVisibleOutsideSearch, marketSecurity } from "@/domain/market";

export type InstrumentLookup =
  | { kind: "found"; instrument: PublicInstrument }
  | { kind: "redirect"; symbol: string }
  | { kind: "missing" };

/**
 * The public instrument for a URL symbol. Symbols match case-insensitively and redirect to their exact
 * spelling; instruments hidden from the market (delisted, matured bonds) are not found.
 */
export const findInstrument = cache(async (raw: string): Promise<InstrumentLookup> => {
  let symbol: string;
  try {
    symbol = decodeURIComponent(raw);
  } catch {
    return { kind: "missing" };
  }
  if (!/^[\p{L}\p{N}._-]{1,32}$/u.test(symbol)) return { kind: "missing" };
  const now = Date.now();
  const instrument = (await getPublicCatalogue(now)).find((item) => item.symbol.toUpperCase() === symbol.toUpperCase());
  if (!instrument) return { kind: "missing" };
  const visible = isVisibleOutsideSearch(
    marketSecurity({ id: instrument.id, symbol: instrument.symbol, kind: instrument.kind, isListed: instrument.isListed }),
    now,
  );
  if (!visible) return { kind: "missing" };
  return instrument.symbol === symbol ? { kind: "found", instrument } : { kind: "redirect", symbol: instrument.symbol };
});
