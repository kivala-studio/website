"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { COMBINED, MAIN, resolveSelection } from "@/domain/portfolio/books";
import { useAccountStores } from "@/features/account/account-provider";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { Menu } from "@/ui/components/menu";
import { RAIL_TILE, RAIL_TILE_IDLE, SectionRail } from "@/ui/components/section-rail";
import { Icon } from "@/ui/icons/icon";

import { useSelectionTitle } from "./book-menu";
import { setPortfolioSelection, useStoredSelection } from "./selection";

const PATH = "/carteira";
const SECTIONS = [`${PATH}/registos`, `${PATH}/rendimentos`];

/**
 * The portfolio area's rail: the portfolio switcher once named portfolios exist (CoinStats' "All Assets"
 * tile), then the area's pages. The overview stays current on a position's page. It reads the ledger
 * store the page loads; it never loads it itself.
 */
export function PortfolioRail() {
  const t = useTranslations();
  const pathname = usePathname();
  const store = useAccountStores()?.portfolio;
  const books = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.getSnapshot().books ?? NO_BOOKS,
    () => NO_BOOKS,
  );
  const overview = pathname === PATH ? "page" : pathname.startsWith(`${PATH}/`) && !SECTIONS.some((path) => pathname.startsWith(path)) ? "true" : false;
  return (
    <SectionRail
      label={t("common.portfolio")}
      leading={books.length > 0 ? <BookSwitcher books={books} /> : null}
      items={[
        { href: PATH, label: t("assetDetails.tab.overview"), icon: "portfolio", current: overview },
        { href: `${PATH}/registos`, label: t("common.records"), icon: "history", testID: "records-link" },
        { href: `${PATH}/rendimentos`, label: t("income.title"), icon: "dividend", testID: "income-link" },
      ]}
    />
  );
}

const NO_BOOKS: readonly never[] = [];
const noSubscribe = () => () => {};

/** Combined, main, then each named portfolio; the selection follows every page of the area. */
function BookSwitcher({ books }: { books: readonly { id: string; name: string }[] }) {
  const t = useTranslations();
  const selection = resolveSelection(useStoredSelection(), books);
  const title = useSelectionTitle({ books, selection });
  return (
    <Menu
      label={t("portfolioBooks.title")}
      align="start"
      testID="book-switcher"
      className="w-full"
      triggerClassName={cn(RAIL_TILE, RAIL_TILE_IDLE, "motion-press border border-hairline text-primary-text")}
      trigger={
        <>
          <Icon name="wallet" scale="l" className="text-accent" />
          <span className="flex max-w-full items-center gap-0.5 font-display leading-tight">
            <span className="sr-only">{t("portfolioBooks.title")}: </span>
            <span className="truncate">{title}</span>
            <Icon name="chevron-down" scale="s" className="shrink-0 text-secondary-text" />
          </span>
        </>
      }
      entries={[
        { kind: "check", label: t("portfolioBooks.combined"), checked: selection === COMBINED, onToggle: () => setPortfolioSelection(COMBINED) },
        { kind: "check", label: t("portfolioBooks.main"), checked: selection === MAIN, onToggle: () => setPortfolioSelection(MAIN) },
        ...books.map((book) => ({ kind: "check" as const, label: book.name, checked: selection === book.id, onToggle: () => setPortfolioSelection(book.id) })),
      ]}
    />
  );
}
