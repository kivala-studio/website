import { type EpochMs, type MarketSecurity, compareText, hasUsableQuote, isVisibleOutsideSearch } from "@/domain/market";
import { allowsFractionalQuantity } from "@/domain/portfolio/records";

import { Sim, type SimulationInstrument } from "./simulation";

const tracked = (security: MarketSecurity) => security.kind === "equity" || security.kind === "fund";

/** iOS `SimulationMarketView.instrument(for:)`: an equity or fund with a usable, positive quote in AOA. Bonds never qualify. */
export function simulationInstrument(security: MarketSecurity, now: EpochMs): SimulationInstrument | null {
  const currency = security.currency?.toUpperCase();
  if (!tracked(security) || !hasUsableQuote(security, now) || !security.price.isFinite() || !security.price.gt(0) || currency !== "AOA") return null;
  return {
    securityId: security.id,
    symbol: security.symbol,
    name: security.name,
    unitPrice: new Sim(security.price.toString()),
    currencyCode: currency,
    allowsFractionalQuantity: allowsFractionalQuantity(security.kind),
  };
}

/** Visible instruments that can be simulated now, by symbol. */
export function eligibleSecurities(securities: readonly MarketSecurity[], now: EpochMs): MarketSecurity[] {
  return securities
    .filter((security) => isVisibleOutsideSearch(security, now) && simulationInstrument(security, now) !== null)
    .sort((a, b) => compareText(a.symbol, b.symbol));
}

/** Some equities or funds are listed but lack a current quote. */
export const hasPartialQuotes = (securities: readonly MarketSecurity[], now: EpochMs, eligible: number) =>
  securities.filter((security) => isVisibleOutsideSearch(security, now) && tracked(security)).length > eligible;
