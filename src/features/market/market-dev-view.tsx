"use client";

import { ErrorPresenter } from "@/features/errors/error-presenter";
import { MARKET_MESSAGE_KEYS, displayPercentageChange, displayPrice, displayPriceLabel } from "@/domain/market";
import { OfflineBanner, ToastHost } from "@/ui/components/feedback";
import { MarketStatusIndicator } from "@/ui/components/financial";
import { AssetRow } from "@/ui/components/rows";

import { MarketProvider, useMarketState, useMarketStore } from "./market-provider";

/** A catalogue row as the server renders it: dated close only, never a current price. */
export type DevInstrument = { id: string; symbol: string; name: string; close: string | null; bond: boolean };

function Rows({ instruments }: { instruments: DevInstrument[] }) {
  const store = useMarketStore();
  const state = useMarketState();
  const snapshot = state.load.kind === "loaded" ? state.load.snapshot : undefined;
  const at = state.assessedAt;
  const securities = new Map(snapshot?.securities.map((security) => [security.id, security]));
  const availability = store.dataAvailability();
  return (
    <div
      className="flex flex-col"
      data-testid="market"
      data-load={state.load.kind}
      data-availability={availability?.state ?? "none"}
      data-suspended={state.isSuspended}
      data-offline={state.isOffline}
    >
      <OfflineBanner forceVisible={state.isOffline} />
      <div className="px-4 py-3">
        <MarketStatusIndicator status={snapshot?.status ?? "unknown"} />
      </div>
      <ul className="divide-y divide-separator px-4">
        {instruments.map((instrument) => {
          const security = securities.get(instrument.id);
          // A last (no longer current) quote needs its dated label, which this row cannot carry:
          // standing rule 2 then asks for "Preço por confirmar" instead of an undated number.
          const shown = security && at !== undefined && displayPriceLabel(security, at) !== MARKET_MESSAGE_KEYS.price.lastQuote;
          const price = shown ? displayPrice(security, at) : undefined;
          const change = shown ? displayPercentageChange(security, at) : undefined;
          return (
            <li key={instrument.id} data-testid="market-row">
              <AssetRow
                symbol={instrument.symbol}
                name={instrument.name}
                price={price ?? (security ? null : instrument.close)}
                change={change ?? null}
                bond={instrument.bond}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Development view of the market store over the server-rendered catalogue. */
export function MarketDevView({ instruments, scenario }: { instruments: DevInstrument[]; scenario?: string }) {
  return (
    <ToastHost>
      <MarketProvider scenario={scenario}>
        <ErrorPresenter />
        <Rows instruments={instruments} />
      </MarketProvider>
    </ToastHost>
  );
}
