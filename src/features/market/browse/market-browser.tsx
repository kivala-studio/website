"use client";

import { useTranslations } from "next-intl";
import { usePathname as useRawPathname, useSearchParams } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";

import {
  type DiscoveryQuery,
  MARKET_CATEGORIES,
  MARKET_CATEGORY_LABEL_KEYS,
  MARKET_SORT_KEYS,
  MARKET_SORT_LABEL_KEYS,
  type MarketSecurity,
  type MarketSortKey,
  SORT_DIRECTION_LABEL_KEYS,
  applyDiscoveryQuery,
  hasUsableQuote,
  kindLabelKey,
  securityDisplayName,
  isVisibleOutsideSearch,
  marketSecurity,
} from "@/domain/market";
import { useMarketState } from "@/features/market/market-provider";
import { useFormat } from "@/ui/format";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { SearchField } from "@/ui/components/controls";
import { SecurityLogo } from "@/ui/components/rows";
import { EmptyState } from "@/ui/components/states";
import { Icon } from "@/ui/icons/icon";

import { type CatalogueRow, ChangeCell, PriceCell } from "./price-cell";
import { MARKET_DEFAULT_QUERY, marketQueryParams, readMarketQuery } from "./query";

const CHIP = "inline-flex min-h-11 items-center rounded-full px-4 text-secondary font-semibold whitespace-nowrap desk:px-3";

/** The query the list is showing; links and the search keep it in the URL. */
function useMarketQuery() {
  const params = useSearchParams();
  const fromURL = readMarketQuery(params);
  const [searchText, setSearchText] = useState(fromURL.searchText);
  const query: DiscoveryQuery = { ...fromURL, searchText };
  const updateSearch = (value: string) => {
    setSearchText(value);
    const next = new URLSearchParams(marketQueryParams({ ...fromURL, searchText: value })).toString();
    window.history.replaceState(window.history.state, "", next ? `?${next}` : window.location.pathname);
  };
  return { query, updateSearch };
}

/**
 * The market list (iOS Markets master): search, categories, sort, result count and rows. Filtering and
 * sorting are the W2 discovery rules, applied to the store's snapshot once it loads and to the server's
 * catalogue before that, so the list renders (and filters, as plain links and a GET form) without JavaScript.
 */
export function MarketBrowser({ rows, renderedAt }: { rows: CatalogueRow[]; renderedAt: number }) {
  const t = useTranslations();
  const translate = (key: string) => t(key as never);
  const format = useFormat();
  const pathname = usePathname();
  const rawPathname = useRawPathname();
  const state = useMarketState();
  const snapshot = state.load.kind === "loaded" ? state.load.snapshot : undefined;
  const at = snapshot ? (state.assessedAt ?? renderedAt) : renderedAt;
  const { query, updateSearch } = useMarketQuery();

  const catalogue = useMemo(
    () =>
      rows.map((row) =>
        marketSecurity({ id: row.id, symbol: row.symbol, kind: row.kind, name: row.name, issuer: row.issuer, quoteAvailability: "unavailable" }),
      ),
    [rows],
  );
  const byID = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const securities: readonly MarketSecurity[] = snapshot?.securities ?? catalogue;
  const results = useMemo(() => applyDiscoveryQuery(securities, query, at), [securities, query.searchText, query.category, query.sortKey, query.direction, at]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasListed = securities.some((security) => isVisibleOutsideSearch(security, at));
  const hasSearch = query.searchText.trim() !== "";
  const href = (change: Partial<DiscoveryQuery>, path = pathname) => ({ pathname: path, query: marketQueryParams({ ...query, ...change }) });
  const hidden = Object.entries(marketQueryParams(query)).filter(([name]) => name !== "q");
  const sortLink = (key: MarketSortKey) =>
    href(key === query.sortKey ? { direction: query.direction === "ascending" ? "descending" : "ascending" } : { sortKey: key });
  const ariaSort = (key: MarketSortKey) => (key === query.sortKey ? query.direction : undefined);

  return (
    <section aria-labelledby="market-list" className="flex min-w-0 flex-col gap-3 @container lg:gap-4">
      <h1 id="market-list" className="text-display text-primary-text">
        {t("common.market")}
      </h1>
      <div className="flex flex-col gap-3 @2xl:flex-row-reverse @2xl:items-center @2xl:justify-between">
      <form
        role="search"
        action={rawPathname}
        onSubmit={(event) => event.preventDefault()}
        className="flex flex-col @2xl:w-64"
      >
        {hidden.map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <SearchField name="q" value={query.searchText} onChange={updateSearch} placeholder={t("common.searchSymbolNameOrIssuer")} />
      </form>

      <nav aria-label={t("news.information.categoryLabel")}>
        <ul className="flex flex-wrap gap-2 desk:gap-1.5">
          {MARKET_CATEGORIES.map((category) => (
            <li key={category}>
              <Link
                href={href({ category })}
                prefetch={false}
                scroll={false}
                aria-current={category === query.category ? "true" : undefined}
                className={cn(CHIP, category === query.category ? "bg-accent text-on-accent" : "bg-elevated-background text-primary-text lg:border lg:border-hairline")}
              >
                {translate(MARKET_CATEGORY_LABEL_KEYS[category])}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-caption text-tertiary-text" aria-live="polite" data-testid="market-count">
          {`${results.length} ${results.length === 1 ? t("legacy.titulo") : t("legacy.titulos")}`}
        </p>
        <span className="flex-1" />
        <details className="relative">
          <summary
            aria-label={t("markets.accessibility.sortBy", { arg1: translate(MARKET_SORT_LABEL_KEYS[query.sortKey]) })}
            className="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-small px-2 text-caption font-semibold text-secondary-text [&::-webkit-details-marker]:hidden"
          >
            {translate(MARKET_SORT_LABEL_KEYS[query.sortKey])}
            <Icon name="chevron-down" scale="s" />
          </summary>
          <ul
            aria-label={t("markets.picker.sortBy")}
            className="absolute right-0 z-20 mt-1 flex min-w-44 flex-col rounded-medium border border-separator bg-elevated-background p-1 shadow-lg"
          >
            {MARKET_SORT_KEYS.map((key) => (
              <li key={key}>
                <Link
                  href={href({ sortKey: key })}
                  prefetch={false}
                  scroll={false}
                  aria-current={key === query.sortKey ? "true" : undefined}
                  onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-small px-3 text-secondary text-primary-text"
                >
                  {translate(MARKET_SORT_LABEL_KEYS[key])}
                  {key === query.sortKey ? <Icon name="check" className="text-accent" /> : null}
                </Link>
              </li>
            ))}
          </ul>
        </details>
        <Link
          href={href({ direction: query.direction === "ascending" ? "descending" : "ascending" })}
          prefetch={false}
          scroll={false}
          aria-label={t("markets.accessibility.order", { arg1: translate(SORT_DIRECTION_LABEL_KEYS[query.direction]) })}
          aria-description={t("markets.accessibility.orderHint")}
          className="flex size-11 items-center justify-center rounded-full text-accent"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-elevated-background">
            <Icon name={query.direction === "ascending" ? "arrow-up" : "arrow-down"} scale="s" />
          </span>
        </Link>
      </div>

      {results.length === 0 ? (
        <div className="py-10">
          <EmptyState
            icon={!hasListed && !hasSearch ? "chart" : "search"}
            title={!hasListed && !hasSearch ? t("common.noInstruments") : t("common.noResults")}
            message={!hasSearch && query.category === "all" ? t("markets.emptyState.noData") : t("markets.emptyState.noMatches")}
            action={
              hasSearch || query.category !== "all" ? (
                <Link
                  href={{ pathname, query: marketQueryParams({ ...MARKET_DEFAULT_QUERY, category: "all", sortKey: query.sortKey, direction: query.direction }) }}
                  prefetch={false}
                  scroll={false}
                  onClick={() => updateSearch("")}
                  className="inline-flex min-h-11 items-center text-secondary font-semibold text-accent"
                >
                  {t("markets.emptyState.clearFilters")}
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="lg:panel lg:overflow-hidden">
        <table className="w-full table-fixed border-collapse" data-testid="market-table">
          <thead className="sr-only @lg:not-sr-only">
            <tr className="text-caption text-secondary-text lg:border-b lg:border-hairline">
              <SortHeader label={t("common.instrument")} sort={ariaSort("name")} href={sortLink("name")} align="left" className="w-auto lg:pl-4" />
              <SortHeader label={t("common.price")} sort={ariaSort("price")} href={sortLink("price")} align="right" className="w-36" />
              <SortHeader
                label={t("common.change")}
                sort={ariaSort("percentageChange")}
                href={sortLink("percentageChange")}
                align="right"
                className="hidden w-28 @lg:table-cell @2xl:pr-0 @max-2xl:lg:pr-4"
              />
              <SortHeader
                label={translate(MARKET_SORT_LABEL_KEYS.volume)}
                sort={ariaSort("volume")}
                href={sortLink("volume")}
                align="right"
                className="hidden w-32 @2xl:table-cell lg:pr-4"
              />
            </tr>
          </thead>
          <tbody>
            {results.map((security) => {
              const row = byID.get(security.id);
              const live = snapshot ? security : undefined;
              const volume = live && hasUsableQuote(live, at) ? format.count(live.volume) : undefined;
              return (
                <tr key={security.id} data-testid="market-row" className="relative border-b border-separator lg:border-hairline lg:last:border-b-0 lg:hover:bg-app-background">
                  <th scope="row" className="py-3 pr-2 text-left font-normal desk:py-2 lg:pl-4">
                    <Link
                      href={{ pathname: `/mercado/${encodeURIComponent(security.symbol)}`, query: marketQueryParams(query) }}
                      prefetch={false}
                      aria-description={t("common.openSecurityDetailsHint")}
                      className="flex min-h-14 min-w-0 items-center gap-3 outline-none after:absolute after:inset-0 after:rounded-small after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent desk:min-h-11"
                    >
                      <SecurityLogo symbol={security.symbol} logoUrl={row?.logoURL ?? security.logoURL} brandColor={row?.bond ? "violet" : "blue"} />
                      <span className="flex min-w-0 flex-col gap-1 desk:gap-0">
                        <span className="truncate text-body font-semibold text-primary-text">{security.symbol}</span>
                        <span className="truncate text-secondary text-secondary-text">{securityDisplayName(security) ?? translate(kindLabelKey(security.kind))}</span>
                      </span>
                    </Link>
                  </th>
                  <td className="py-3 text-right align-middle desk:py-2">
                    <PriceCell row={row} security={live} at={snapshot ? at : undefined} inlineChange="@lg:hidden" />
                  </td>
                  <td className="hidden py-3 pl-2 text-right align-middle desk:py-2 @lg:table-cell @max-2xl:lg:pr-4">
                    <ChangeCell row={row} security={live} at={snapshot ? at : undefined} />
                  </td>
                  <td className="hidden py-3 pl-2 text-right align-middle text-body text-primary-text desk:py-2 @2xl:table-cell lg:pr-4">
                    {volume ?? <span aria-hidden className="text-tertiary-text">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </section>
  );
}

function SortHeader({
  label,
  sort,
  href,
  align,
  className,
}: {
  label: string;
  sort: "ascending" | "descending" | undefined;
  href: { pathname: string; query: Record<string, string> };
  align: "left" | "right";
  className?: string;
}): ReactNode {
  return (
    <th scope="col" aria-sort={sort} className={cn("pb-1 font-semibold", align === "right" ? "text-right" : "text-left", className)}>
      <Link
        href={href}
        prefetch={false}
        scroll={false}
        className={cn("inline-flex min-h-11 items-center gap-1 rounded-small", align === "right" && "flex-row-reverse", sort && "text-primary-text")}
      >
        {label}
        {sort ? <Icon name={sort === "ascending" ? "arrow-up" : "arrow-down"} scale="s" /> : null}
      </Link>
    </th>
  );
}
