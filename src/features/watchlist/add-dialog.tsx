"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useState, useSyncExternalStore } from "react";

import { compareText, isVisibleOutsideSearch, kindSearchTerms, marketSecurity, searchSecurities, securityDisplayName } from "@/domain/market";
import { useAccountStores } from "@/features/account/account-provider";
import type { CatalogueRow } from "@/features/market/browse/price-cell";
import { useMarketState } from "@/features/market/market-provider";
import { SearchField } from "@/ui/components/controls";
import { Dialog } from "@/ui/components/dialog";
import { SecurityLogo } from "@/ui/components/rows";
import { EmptyState } from "@/ui/components/states";
import { Icon } from "@/ui/icons/icon";

/**
 * `Adicionar instrumentos` (iOS `WatchlistAddView`): every instrument not yet followed, by name, filtered by the
 * shared search. A press adds at once and the dialog stays open for more.
 */
export function AddDialog({ open, onClose, rows, renderedAt }: { open: boolean; onClose: () => void; rows: readonly CatalogueRow[]; renderedAt: number }) {
  const t = useTranslations();
  const stores = useAccountStores()!;
  const list = useSyncExternalStore(stores.watchlist.subscribe, stores.watchlist.getSnapshot, stores.watchlist.getSnapshot);
  const market = useMarketState();
  const [query, setQuery] = useState("");
  const resultsID = useId();
  const at = market.assessedAt ?? renderedAt;
  const byID = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const securities = useMemo(
    () =>
      market.load.kind === "loaded"
        ? market.load.snapshot.securities
        : rows.map((row) => marketSecurity({ id: row.id, symbol: row.symbol, kind: row.kind, name: row.name, issuer: row.issuer, quoteAvailability: "unavailable" })),
    [market.load, rows],
  );
  const translate = (key: string) => t(key as never);
  const candidates = useMemo(() => {
    const watched = new Set(list.order);
    const pool = securities.filter((security) => !watched.has(security.id) && isVisibleOutsideSearch(security, at));
    if (query.trim() !== "") return searchSecurities(pool, query, { now: at, kindTerms: kindSearchTerms(translate) });
    return pool.sort((a, b) => compareText(securityDisplayName(a) ?? a.symbol, securityDisplayName(b) ?? b.symbol));
  }, [securities, list.order, query, at]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog
      open={open}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      title={t("common.addInstruments")}
    >
      <div className="flex flex-col gap-3" data-testid="add-dialog">
        <SearchField value={query} onChange={setQuery} controls={resultsID} autoFocus />
        {candidates.length === 0 ? (
          <div className="py-8">
            {query.trim() === "" ? (
              <EmptyState icon="check-circle" title={t("watchlist.addSheet.allAddedTitle")} message={t("watchlist.addSheet.allAddedMessage")} />
            ) : (
              <EmptyState icon="search" title={t("common.noResults")} message={t("watchlist.addSheet.searchMessage")} />
            )}
          </div>
        ) : (
          <ul id={resultsID} className="flex flex-col divide-y divide-hairline">
            {candidates.map((security) => {
              const row = byID.get(security.id);
              const name = securityDisplayName(security) ?? row?.name ?? security.symbol;
              return (
                <li key={security.id}>
                  <button
                    type="button"
                    onClick={() => stores.watchlist.setWatched(security.id, true)}
                    aria-label={t("watchlist.accessibility.addSecurity", { arg1: security.symbol, arg2: name })}
                    className="flex min-h-16 w-full items-center gap-3 py-2 text-left"
                    data-testid="add-candidate"
                  >
                    <SecurityLogo symbol={security.symbol} logoUrl={row?.logoURL ?? security.logoURL} brandColor={row?.bond ? "violet" : "blue"} size="s" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body font-semibold text-primary-text">{security.symbol}</span>
                      <span className="truncate text-secondary text-secondary-text">{name}</span>
                    </span>
                    <Icon name="add" className="text-accent" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
