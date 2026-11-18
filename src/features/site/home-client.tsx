"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { type CatalogueRow, ChangeCell, PriceCell } from "@/features/market/browse/price-cell";
import { ButtonLink } from "@/ui/components/buttons";
import { SearchField, SectionTabs } from "@/ui/components/controls";
import { Card } from "@/ui/components/layout";
import { SecurityLogo } from "@/ui/components/rows";
import { DataTable, TableCell, TableHead, TableHeaderCell, TableNameCell, TableRow } from "@/ui/components/table";

/**
 * The hero search: a plain GET form to the market list, which reads `q` and the category from the URL, so it works
 * before (and without) JavaScript.
 */
export function HeroSearch({ action, hidden }: { action: string; hidden: Record<string, string> }) {
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
  const prefix = "home-market";
  return (
    <Card flush className="w-full overflow-hidden panel">
      <SectionTabs
        titles={tabs.map((tab) => tab.title)}
        selected={selected}
        onSelect={setSelected}
        label={label}
        idPrefix={prefix}
        className="px-4 max-sm:gap-4 desk:px-6"
      />
      {tabs.map((tab, index) => (
        <div key={tab.title} role="tabpanel" id={`${prefix}-panel-${index}`} aria-labelledby={`${prefix}-tab-${index}`} hidden={index !== selected}>
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
