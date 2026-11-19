"use client";

import { useTranslations } from "next-intl";
import { usePathname as useRawPathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

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
  securityDisplayName,
  isVisibleOutsideSearch,
  marketSecurity,
} from "@/domain/market";
import { useMarketState } from "@/features/market/market-provider";
import { useFormat } from "@/ui/format";
import { Link, usePathname } from "@/i18n/navigation";
import { buttonClass, iconButtonClass } from "@/ui/components/button-styles";
import { NavTabs, SearchField } from "@/ui/components/controls";
import { Card } from "@/ui/components/layout";
import { SecurityLogo } from "@/ui/components/rows";
import { FlipList } from "@/ui/components/flip-list";
import { EmptyState, FadeIn } from "@/ui/components/states";
import { DataTable, TableCell, TableHead, TableNameCell, TableRow, TableSortHeader } from "@/ui/components/table";
import { Icon } from "@/ui/icons/icon";

import { type CatalogueRow, ChangeCell, PriceCell } from "./price-cell";
import { MARKET_DEFAULT_QUERY, marketQueryParams, readMarketQuery } from "./query";

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

/** A trailing tab-row link to another page (Notícias, Aprender for signed-in visitors). */
export type MarketBrowserLink = { href: string; title: string };

/**
 * The market list (iOS Markets master): category tabs with the search and sort beside them, the result count and
 * the table. Filtering and sorting are the W2 discovery rules, applied to the store's snapshot once it loads and to
 * the server's catalogue before that, so the list renders (and filters, as plain links and a GET form) without
 * JavaScript. Another sort, category or search: rows that stay glide to their new places and new ones fade in.
 */
export function MarketBrowser({ rows, renderedAt, links = [] }: { rows: CatalogueRow[]; renderedAt: number; links?: MarketBrowserLink[] }) {
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
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex min-w-0 flex-1 gap-6 overflow-x-auto border-b border-hairline [scrollbar-width:none]">
          <NavTabs
            bare
            label={t("news.information.categoryLabel")}
            linkProps={{ prefetch: false, scroll: false }}
            items={MARKET_CATEGORIES.map((category) => ({
              href: href({ category }),
              title: translate(MARKET_CATEGORY_LABEL_KEYS[category]),
              current: category === query.category,
            }))}
          />
          {links.length > 0 ? (
            <NavTabs
              bare
              label={t("common.market")}
              linkProps={{ prefetch: false }}
              items={links}
              className="flex shrink-0 items-center gap-6 before:h-5 before:w-px before:bg-hairline before:content-['']"
            />
          ) : null}
        </div>
        <form role="search" action={rawPathname} onSubmit={(event) => event.preventDefault()} className="lg:w-80 lg:shrink-0">
          {hidden.map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <SearchField name="q" value={query.searchText} onChange={updateSearch} placeholder={t("common.searchSymbolNameOrIssuer")} />
        </form>
      </div>

      <div className="flex min-h-11 items-center gap-2">
        <p className="flex-1 text-caption text-tertiary-text" aria-live="polite" data-testid="market-count">
          {`${results.length} ${results.length === 1 ? t("legacy.titulo") : t("legacy.titulos")}`}
        </p>
        {/* From 768 px every column header is a sort link, so the menu and the direction button are for narrower lists. */}
        <div className="flex shrink-0 items-center gap-2 md:hidden">
          <details className="group relative shrink-0">
            <summary
              aria-label={t("markets.accessibility.sortBy", { arg1: translate(MARKET_SORT_LABEL_KEYS[query.sortKey]) })}
              className={buttonClass("outline", "cursor-pointer list-none gap-1! px-3! [&::-webkit-details-marker]:hidden", "compact")}
            >
              {translate(MARKET_SORT_LABEL_KEYS[query.sortKey])}
              <Icon name="chevron-down" scale="s" className="motion-turn text-secondary-text group-open:rotate-180" />
            </summary>
            <ul
              aria-label={t("markets.picker.sortBy")}
              className="motion-pop absolute right-0 z-20 origin-top-right mt-1 flex min-w-44 flex-col rounded-medium border border-card-border bg-card-background p-1 shadow-panel"
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
            className={iconButtonClass("outline")}
          >
            <Icon name={query.direction === "ascending" ? "arrow-up" : "arrow-down"} scale="s" className="text-accent" />
          </Link>
        </div>
      </div>

      {results.length === 0 ? (
        <FadeIn className="py-10">
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
        </FadeIn>
      ) : (
        <Card flush className="overflow-hidden panel">
          <DataTable className="table-fixed" data-testid="market-table">
            <TableHead>
              <TableSortHeader label={t("common.instrument")} sort={ariaSort("name")} href={sortLink("name")} />
              <TableSortHeader label={t("common.price")} sort={ariaSort("price")} href={sortLink("price")} align="right" className="w-36 sm:w-44" />
              <TableSortHeader
                label={t("common.change")}
                sort={ariaSort("percentageChange")}
                href={sortLink("percentageChange")}
                align="right"
                className="hidden w-32 sm:table-cell"
              />
              <TableSortHeader
                label={translate(MARKET_SORT_LABEL_KEYS.volume)}
                sort={ariaSort("volume")}
                href={sortLink("volume")}
                align="right"
                className="hidden w-36 md:table-cell"
              />
            </TableHead>
            <FlipList as="tbody">
              {results.map((security) => {
                const row = byID.get(security.id);
                const live = snapshot ? security : undefined;
                const volume = live && hasUsableQuote(live, at) ? format.count(live.volume) : undefined;
                const name = securityDisplayName(security);
                return (
                  <TableRow key={security.id} data-flip-key={security.id} data-testid="market-row">
                    <TableNameCell
                      logo={
                        <span className="flex shrink-0 max-[22.5rem]:hidden">
                          <SecurityLogo symbol={security.symbol} logoUrl={row?.logoURL ?? security.logoURL} brandColor={row?.bond ? "violet" : "blue"} size="s" />
                        </span>
                      }
                      name={name ?? security.symbol}
                      symbol={name ? security.symbol : undefined}
                      href={{ pathname: `/mercado/${encodeURIComponent(security.symbol)}`, query: marketQueryParams(query) }}
                      linkProps={{ "aria-description": t("common.openSecurityDetailsHint") }}
                      stackOnPhone
                    />
                    <TableCell numeric>
                      <PriceCell row={row} security={live} at={snapshot ? at : undefined} inlineChange="sm:hidden" />
                    </TableCell>
                    <TableCell numeric className="hidden sm:table-cell">
                      <ChangeCell row={row} security={live} at={snapshot ? at : undefined} />
                    </TableCell>
                    <TableCell numeric className="hidden md:table-cell">
                      {volume ?? <span aria-hidden className="text-tertiary-text">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </FlipList>
          </DataTable>
        </Card>
      )}
    </div>
  );
}
