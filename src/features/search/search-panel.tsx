"use client";

import { useTranslations } from "next-intl";
import { type KeyboardEvent, useId, useMemo, useState, useSyncExternalStore } from "react";

import {
  MARKET_CATEGORY_LABEL_KEYS,
  type MarketCategory,
  type MarketSecurity,
  type SecurityKind,
  categoryIncludesKind,
  compareText,
  isVisibleOutsideSearch,
  kindLabelKey,
  kindSearchTerms,
  marketSecurity,
  recordRecentSearch,
  searchSecurities,
  securityDisplayName,
} from "@/domain/market";
import { useAccount } from "@/features/account/account-provider";
import { ACCOUNT_STORAGE_PREFIX } from "@/features/auth/account-state";
import { type CatalogueRow, PriceCell } from "@/features/market/browse/price-cell";
import { marketQueryParams, MARKET_DEFAULT_QUERY } from "@/features/market/browse/query";
import { useMarketState } from "@/features/market/market-provider";
import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { SearchField } from "@/ui/components/controls";
import { SectionHeader } from "@/ui/components/layout";
import { SecurityLogo } from "@/ui/components/rows";
import { EmptyState } from "@/ui/components/states";
import { useFormat } from "@/ui/format";

import { WatchStar } from "./watch-star";

const CATEGORIES: readonly Exclude<MarketCategory, "all">[] = ["equities", "bonds", "funds", "treasury"];
const KIND_ORDER: readonly SecurityKind[] = ["equity", "corporateBond", "fund", "treasuryBond", "other"];
const CATEGORY_TONE: Record<Exclude<MarketCategory, "all">, string> = {
  equities: "bg-accent/12 text-accent",
  bonds: "bg-brand-violet/12 text-brand-violet",
  funds: "bg-positive/12 text-positive",
  treasury: "bg-warning/12 text-warning",
};
const HIGHEST_VOLUME = 6;

/** Recently opened instruments, per account, in this browser (cleared at sign-out with the other account keys). */
function recentsStore(userID: string) {
  const key = `${ACCOUNT_STORAGE_PREFIX}${userID}.recentSearches`;
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; ids: string[] } = { raw: null, ids: [] };
  const read = () => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      // Unavailable storage keeps no recents.
    }
    if (raw === cache.raw) return cache.ids;
    let ids: string[] = [];
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) ids = parsed.filter((id): id is string => typeof id === "string").slice(0, 8);
    } catch {
      // A damaged value starts over.
    }
    cache = { raw, ids };
    return ids;
  };
  const write = (ids: string[]) => {
    try {
      if (ids.length === 0) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      // Not kept: recents are a convenience.
    }
    for (const listener of listeners) listener();
  };
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => event.key === key && listener();
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    read,
    record: (id: string) => write(recordRecentSearch(read(), id)),
    clear: () => write([]),
  };
}

const EMPTY: string[] = [];

function useRecents(userID: string | undefined) {
  const store = useMemo(() => (userID && typeof window !== "undefined" ? recentsStore(userID) : null), [userID]);
  const ids = useSyncExternalStore(
    store?.subscribe ?? (() => () => {}),
    store?.read ?? (() => EMPTY),
    () => EMPTY,
  );
  return { ids, record: (id: string) => store?.record(id), clear: () => store?.clear() };
}

/** Securities to search: the store's snapshot once loaded (prices, volume), the server catalogue before. */
function useSearchable(rows: readonly CatalogueRow[]) {
  const state = useMarketState();
  const snapshot = state.load.kind === "loaded" ? state.load.snapshot : undefined;
  const catalogue = useMemo(
    () =>
      rows.map((row) =>
        marketSecurity({ id: row.id, symbol: row.symbol, kind: row.kind, name: row.name, issuer: row.issuer, quoteAvailability: "unavailable" }),
      ),
    [rows],
  );
  return { securities: snapshot?.securities ?? catalogue, at: state.assessedAt, loaded: snapshot !== undefined };
}

/**
 * Find an instrument fast (iOS `SearchView`): categories with their real counts, recents, highest volume, and
 * results grouped by kind with a star on each row. Used by the search page and the command palette.
 */
export function SearchPanel({
  rows,
  renderedAt,
  autoFocus = false,
}: {
  rows: readonly CatalogueRow[];
  renderedAt: number;
  autoFocus?: boolean;
}) {
  const t = useTranslations();
  const format = useFormat();
  const account = useAccount();
  const recents = useRecents(account?.userID);
  const { securities, at: assessedAt, loaded } = useSearchable(rows);
  const at = assessedAt ?? renderedAt;
  const [query, setQuery] = useState("");
  const resultsID = useId();
  const byID = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const translate = (key: string) => t(key as never);

  const visible = useMemo(() => securities.filter((security) => isVisibleOutsideSearch(security, at)), [securities, at]);
  const results = useMemo(
    () => (query.trim() === "" ? [] : searchSecurities(securities, query, { now: at, kindTerms: kindSearchTerms(translate) })),
    [securities, query, at], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const groups = useMemo(
    () => KIND_ORDER.map((kind) => ({ kind, items: results.filter((security) => security.kind === kind) })).filter((group) => group.items.length > 0),
    [results],
  );
  const recentSecurities = useMemo(() => {
    const byKey = new Map(visible.map((security) => [security.id, security]));
    return recents.ids.flatMap((id) => byKey.get(id) ?? []);
  }, [recents.ids, visible]);
  const highestVolume = useMemo(
    () =>
      loaded
        ? visible
            .filter((security) => security.volume.gt(0))
            .sort((a, b) => b.volume.comparedTo(a.volume) || compareText(a.symbol, b.symbol))
            .slice(0, HIGHEST_VOLUME)
        : [],
    [visible, loaded],
  );


  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      document.getElementById(resultsID)?.querySelector<HTMLElement>("a[href]")?.focus();
    }
  };

  const row = (security: MarketSecurity) => {
    const catalogueRow = byID.get(security.id);
    return (
      <li key={security.id} className="flex items-center gap-1 border-b border-separator last:border-b-0">
        <Link
          href={`/mercado/${encodeURIComponent(security.symbol)}`}
          prefetch={false}
          onClick={() => recents.record(security.id)}
          className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-small py-2"
          data-testid="search-result"
        >
          <SecurityLogo symbol={security.symbol} logoUrl={catalogueRow?.logoURL ?? security.logoURL} brandColor={catalogueRow?.bond ? "violet" : "blue"} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-body font-semibold text-primary-text">{security.symbol}</span>
            <span className="truncate text-caption text-secondary-text">{securityDisplayName(security) ?? translate(kindLabelKey(security.kind))}</span>
          </span>
          <PriceCell row={catalogueRow} security={loaded ? security : undefined} at={assessedAt} />
        </Link>
        <WatchStar id={security.id} symbol={security.symbol} />
      </li>
    );
  };

  const searching = query.trim() !== "";
  return (
    <div className="flex flex-col gap-8">
      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <SearchField value={query} onChange={setQuery} placeholder={t("search.field.prompt")} autoFocus={autoFocus} onKeyDown={onKeyDown} controls={resultsID} />
      </form>
      <div id={resultsID} className="flex flex-col gap-8" aria-live="polite" aria-busy={!loaded && searching ? true : undefined}>
        {searching ? (
          groups.length === 0 ? (
            <EmptyState icon="search" title={t("search.emptyState.noResults", { arg1: query.trim() })} />
          ) : (
            groups.map((group) => (
              <section key={group.kind} aria-labelledby={`${resultsID}-${group.kind}`} className="flex flex-col gap-1">
                <SectionHeader id={`${resultsID}-${group.kind}`} title={translate(kindLabelKey(group.kind))} />
                <ul className="flex flex-col">{group.items.map(row)}</ul>
              </section>
            ))
          )
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CATEGORIES.map((category) => {
                const count = visible.filter((security) => categoryIncludesKind(category, security.kind)).length;
                return (
                  <li key={category}>
                    <Link
                      href={{ pathname: "/mercado", query: marketQueryParams({ ...MARKET_DEFAULT_QUERY, category }) }}
                      prefetch={false}
                      className={cn("flex min-h-24 flex-col justify-between gap-3 rounded-large p-4", CATEGORY_TONE[category])}
                    >
                      <span className="text-body font-semibold">{translate(MARKET_CATEGORY_LABEL_KEYS[category])}</span>
                      <span className="text-section text-primary-text">{format.count(count)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {recentSecurities.length > 0 ? (
              <section aria-labelledby={`${resultsID}-recents`} className="flex flex-col gap-1">
                <SectionHeader
                  id={`${resultsID}-recents`}
                  title={t("search.header.recents")}
                  action={
                    <button type="button" onClick={recents.clear} className="inline-flex min-h-11 items-center rounded-small px-2 text-secondary font-semibold text-accent">
                      {t("search.header.clear")}
                    </button>
                  }
                />
                <ul className="flex flex-col">{recentSecurities.map(row)}</ul>
              </section>
            ) : null}
            {highestVolume.length > 0 ? (
              <section aria-labelledby={`${resultsID}-volume`} className="flex flex-col gap-1">
                <SectionHeader id={`${resultsID}-volume`} title={t("search.header.highestVolume")} />
                <p className="text-caption text-secondary-text">{t("search.header.volumeNote")}</p>
                <ul className="flex flex-col">{highestVolume.map(row)}</ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
