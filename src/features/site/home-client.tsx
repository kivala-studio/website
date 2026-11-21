"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { type CatalogueRow, ChangeCell, PriceCell } from "@/features/market/browse/price-cell";
import { cn } from "@/ui/cn";
import { ButtonLink, IconButton } from "@/ui/components/buttons";
import { SearchField, SectionTabs } from "@/ui/components/controls";
import { Card, PAGE_CONTAINER } from "@/ui/components/layout";
import { SecurityLogo } from "@/ui/components/rows";
import { DataTable, TableCell, TableHead, TableHeaderCell, TableNameCell, TableRow } from "@/ui/components/table";
import { prefersReducedMotion } from "@/ui/motion/tokens";

/**
 * The market search: a plain GET form to the market list, which reads `q` and the category from the URL, so it works
 * before (and without) JavaScript.
 */
export function MarketSearch({ action, hidden }: { action: string; hidden: Record<string, string> }) {
  const t = useTranslations();
  const [value, setValue] = useState("");
  return (
    <form role="search" aria-label={t("common.searchInstruments")} action={action} method="get" className="w-full">
      {Object.entries(hidden).map(([name, field]) => (
        <input key={name} type="hidden" name={name} value={field} />
      ))}
      <SearchField name="q" value={value} onChange={setValue} placeholder={t("common.searchSymbolNameOrIssuer")} className="min-h-13! desk:min-h-12! desk:pl-4!" />
    </form>
  );
}

export type PreviewTab = {
  title: string;
  /** The market list filtered to this kind. */
  href: { pathname: string; query: Record<string, string> };
  /** `name` is the instrument or issuer name when it says more than the symbol. */
  rows: { row: CatalogueRow; name?: string }[];
};

/**
 * One product window: the kind tabs on top of a short table of the server's rows, each kind's "Ver tudo" pill under
 * its table. Prices are the dated verified closes the server sent: this page is cached HTML and has no market store,
 * so it never shows a current quote.
 */
export function MarketPreview({ tabs, label }: { tabs: PreviewTab[]; label: string }) {
  const t = useTranslations();
  const [selected, setSelected] = useState(0);
  // After the first switch, a panel fades in each time it is shown (its animation restarts as `hidden` lifts).
  const [switched, setSwitched] = useState(false);
  const prefix = "home-market";
  return (
    <Card flush className="w-full overflow-hidden panel">
      <SectionTabs
        titles={tabs.map((tab) => tab.title)}
        selected={selected}
        onSelect={(index) => (setSwitched(true), setSelected(index))}
        label={label}
        idPrefix={prefix}
        className="px-4 max-sm:gap-4 desk:px-6"
      />
      {tabs.map((tab, index) => (
        <div key={tab.title} role="tabpanel" id={`${prefix}-panel-${index}`} aria-labelledby={`${prefix}-tab-${index}`} hidden={index !== selected} className={cn(switched && "motion-fade-in")}>
          <DataTable className="table-fixed" data-testid="home-market-table">
            <TableHead>
              <TableHeaderCell>{t("common.instrument")}</TableHeaderCell>
              <TableHeaderCell align="right" className="w-34 sm:w-44">
                {t("common.price")}
              </TableHeaderCell>
              <TableHeaderCell align="right" className="hidden w-28 min-[26rem]:table-cell sm:w-36">
                {t("common.change")}
              </TableHeaderCell>
            </TableHead>
            <tbody>
              {tab.rows.map(({ row, name }) => (
                <TableRow key={row.id}>
                  <TableNameCell
                    logo={<SecurityLogo symbol={row.symbol} logoUrl={row.logoURL} brandColor={row.bond ? "violet" : "blue"} size="s" />}
                    name={name ?? row.symbol}
                    symbol={name ? row.symbol : undefined}
                    href={`/mercado/${encodeURIComponent(row.symbol)}`}
                  />
                  <TableCell numeric>
                    <PriceCell row={row} security={undefined} at={undefined} />
                  </TableCell>
                  <TableCell numeric className="hidden min-[26rem]:table-cell">
                    <ChangeCell row={row} security={undefined} at={undefined} />
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </DataTable>
          <div className="flex justify-center border-t border-hairline p-4">
            <ButtonLink href={tab.href} prefetch={false} kind="outline" className="w-auto! px-8! desk:px-8!">
              {t("common.viewAll")}
            </ButtonLink>
          </div>
        </div>
      ))}
    </Card>
  );
}

/**
 * Where a deck's row starts and ends: on the page column's content edge (`PAGE_CONTAINER`: 75rem at most, 16 px
 * gutters, 24 px from 640 px), so the first card lines up with the content above while the row runs to the window's
 * edges and the next card peeks in. The same inset is the scroll padding, so cards snap to that edge.
 */
const DECK_INSET =
  "px-[max(1rem,calc((100%_-_75rem)/2_+_1rem))] scroll-px-[max(1rem,calc((100%_-_75rem)/2_+_1rem))] sm:px-[max(1.5rem,calc((100%_-_75rem)/2_+_1.5rem))] sm:scroll-px-[max(1.5rem,calc((100%_-_75rem)/2_+_1.5rem))]";

/**
 * A deck: a row of `DeckCard`s that scrolls sideways (scroll snap, the scrollbar hidden), under the section's chip
 * and round previous and next buttons. The row is plain overflow, so touch, a trackpad and Tab (each card is a link)
 * move through it without JavaScript; the buttons, shown once hydrated, scroll it by one card and are disabled at
 * its ends (both hidden when every card fits). No auto-play, no loop. `label` names the list. A scroll-reveal target.
 */
export function Deck({ id, label, chip, children }: { id: string; label: string; chip: ReactNode; children: ReactNode }) {
  const t = useTranslations("site.home");
  const list = useRef<HTMLUListElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<{ start: boolean; end: boolean } | null>(null);

  useEffect(() => {
    const row = list.current;
    if (!row) return;
    const update = () => {
      const next = { start: row.scrollLeft <= 1, end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 1 };
      setEdges((last) => (last?.start === next.start && last.end === next.end ? last : next));
    };
    update();
    row.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => {
      row.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  // A button that turns disabled under focus hands it to the other one, so focus never drops to the page.
  useEffect(() => {
    const buttons = controls.current?.querySelectorAll("button");
    if (!edges || !buttons || buttons.length < 2) return;
    const [previous, next] = buttons;
    if (edges.start && document.activeElement === previous && !edges.end) next.focus();
    if (edges.end && document.activeElement === next && !edges.start) previous.focus();
  }, [edges]);

  const scroll = (direction: 1 | -1) => {
    const row = list.current;
    const card = row?.firstElementChild;
    if (!row || !(card instanceof HTMLElement)) return;
    const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0;
    row.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  const fits = edges?.start && edges.end;
  return (
    <div data-reveal className="flex flex-col gap-6">
      <div className={cn(PAGE_CONTAINER, "flex min-h-12 items-center justify-between gap-4")}>
        {chip}
        <div ref={controls} className={cn("flex gap-2", (!edges || fits) && "invisible")}>
          <IconButton icon="arrow-left" label={t("previous")} variant="surface" aria-controls={id} disabled={!edges || edges.start} onClick={() => scroll(-1)} />
          <IconButton icon="arrow-right" label={t("next")} variant="surface" aria-controls={id} disabled={!edges || edges.end} onClick={() => scroll(1)} />
        </div>
      </div>
      <ul
        id={id}
        ref={list}
        aria-label={label}
        className={cn(
          "flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain py-2 [scrollbar-width:none] lg:gap-6 [&::-webkit-scrollbar]:hidden",
          DECK_INSET,
        )}
      >
        {children}
      </ul>
    </div>
  );
}
