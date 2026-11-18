"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { marketSecurity } from "@/domain/market";
import { CompactRow } from "@/features/market/browse/market-overview";
import { ChangeCell, PriceCell } from "@/features/market/browse/price-cell";
import { ChangeBadge, FinancialValue, MarketMetric, MarketStatusIndicator, type MarketStatus } from "@/ui/components/financial";
import { Card, Panel } from "@/ui/components/layout";
import { AssetRow, FeatureRow, SecurityLogo } from "@/ui/components/rows";
import { SeeAll } from "@/ui/components/see-all";
import { DataTable, TableCell, TableHead, TableHeaderCell, TableNameCell, TableRow, TableSortHeader } from "@/ui/components/table";

import { GallerySection, SAMPLE_INSTRUMENTS, SAMPLE_ROWS, SPECIMEN_GRID, Specimen, Variant } from "./specimen";

const HERE = "/dev/design";
const STATUSES: readonly MarketStatus[] = ["open", "openingSoon", "closed", "unknown"];

export function DataDisplay() {
  const t = useTranslations();
  const securities = useMemo(
    () => SAMPLE_INSTRUMENTS.map((item) => marketSecurity({ id: item.symbol, symbol: item.symbol, kind: "equity", name: item.name })),
    [],
  );

  return (
    <GallerySection id="data" title="Data display">
      <Specimen name="DataTable · TableSortHeader · TableNameCell · PriceCell">
        <Card title={t("common.market")} titleId="gallery-table-title" flush action={<SeeAll href={HERE} />} className="overflow-hidden panel">
          <DataTable className="table-fixed">
            <TableHead>
              <TableSortHeader label={t("common.instrument")} sort={undefined} href={HERE} />
              <TableSortHeader label={t("common.price")} sort="descending" href={HERE} align="right" className="w-36 sm:w-44" />
              <TableSortHeader label={t("common.change")} sort={undefined} href={HERE} align="right" className="hidden w-32 sm:table-cell" />
              <TableHeaderCell align="right" className="hidden w-36 md:table-cell">
                {t("markets.sort.volume")}
              </TableHeaderCell>
            </TableHead>
            <tbody>
              {SAMPLE_INSTRUMENTS.map((item) => (
                <TableRow key={item.symbol}>
                  <TableNameCell
                    logo={<SecurityLogo symbol={item.symbol} brandColor={item.color} size="s" />}
                    name={item.name}
                    symbol={item.symbol}
                    href={HERE}
                    stackOnPhone
                  />
                  <TableCell numeric>
                    <span className="flex flex-col items-end gap-1">
                      <FinancialValue value={item.price} className="text-body font-semibold" />
                      <ChangeBadge value={item.change} className="sm:hidden" />
                    </span>
                  </TableCell>
                  <TableCell numeric className="hidden sm:table-cell">
                    <ChangeBadge value={item.change} />
                  </TableCell>
                  <TableCell numeric className="hidden md:table-cell">
                    {item.volume}
                  </TableCell>
                </TableRow>
              ))}
              {SAMPLE_ROWS.map((row) => (
                <TableRow key={row.id}>
                  <TableNameCell
                    logo={<SecurityLogo symbol={row.symbol} brandColor={row.bond ? "violet" : "blue"} size="s" />}
                    name={row.name}
                    symbol={row.symbol}
                    href={HERE}
                    stackOnPhone
                  />
                  <TableCell numeric>
                    <PriceCell row={row} security={undefined} at={undefined} />
                  </TableCell>
                  <TableCell numeric className="hidden sm:table-cell">
                    <ChangeCell row={row} security={undefined} at={undefined} />
                  </TableCell>
                  <TableCell numeric className="hidden md:table-cell">
                    <span aria-hidden className="text-tertiary-text">
                      —
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </DataTable>
        </Card>
      </Specimen>

      <Specimen name="TableNameCell detail · columns folding with max-md:hidden">
        <Card flush className="overflow-hidden panel">
          <DataTable className="table-fixed">
            <TableHead>
              <TableHeaderCell>{t("common.instrument")}</TableHeaderCell>
              <TableHeaderCell align="right" className="w-28 max-md:hidden">
                {t("common.quantity")}
              </TableHeaderCell>
              <TableHeaderCell align="right" className="w-36 sm:w-44">
                {t("common.value")}
              </TableHeaderCell>
            </TableHead>
            <tbody>
              {SAMPLE_INSTRUMENTS.slice(0, 2).map((item) => (
                <TableRow key={item.symbol}>
                  <TableNameCell
                    logo={<SecurityLogo symbol={item.symbol} brandColor={item.color} size="s" />}
                    name={item.symbol}
                    href={HERE}
                    detail={
                      <>
                        <span className="truncate">{item.name}</span>
                        <span className="md:hidden">120</span>
                      </>
                    }
                  />
                  <TableCell numeric className="max-md:hidden">
                    120
                  </TableCell>
                  <TableCell numeric>
                    <FinancialValue value={item.price} className="text-body font-semibold" />
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </DataTable>
        </Card>
      </Specimen>

      <div className={SPECIMEN_GRID}>
        <Specimen name="CompactRow in a Panel">
          <Panel title={t("common.yourWatchlist")} titleId="gallery-compact-title" action={<SeeAll href={HERE} />}>
            <ul className="flex flex-col">
              {securities.map((security, index) => (
                <CompactRow key={security.id} security={security} row={undefined}>
                  <FinancialValue value={SAMPLE_INSTRUMENTS[index].price} className="text-secondary font-semibold" />
                  <span className="flex min-w-18 shrink-0 justify-end">
                    <ChangeBadge value={SAMPLE_INSTRUMENTS[index].change} />
                  </span>
                </CompactRow>
              ))}
            </ul>
          </Panel>
        </Specimen>

        <Specimen name="AssetRow">
          <div className="flex flex-col divide-y divide-hairline">
            <AssetRow symbol="BAIAAAAA" name="Banco Angolano de Investimentos" price="65000" change="2.14" href={HERE} />
            <AssetRow symbol="OT-NR-2030" name="Obrigação do Tesouro 2030" price="98.5" change="0" bond brandColor="violet" />
            <AssetRow symbol="ENSAAAAA" name="ENSA Seguros de Angola" price={null} brandColor="violet" />
          </div>
        </Specimen>
      </div>

      <div className={SPECIMEN_GRID}>
        <Specimen name="FinancialValue">
          <Variant label='style="display"'>
            <FinancialValue value="1250000" style="display" />
          </Variant>
          <Variant label='style="price"'>
            <FinancialValue value="72500" style="price" />
          </Variant>
          <Variant label='style="standard" · bond'>
            <FinancialValue value="98.5" bond />
          </Variant>
        </Specimen>

        <div className="flex flex-col gap-10">
          <Specimen name="ChangeBadge">
            <div className="flex flex-wrap gap-2">
              <ChangeBadge value="2.14" />
              <ChangeBadge value="-0.62" />
              <ChangeBadge value="0" />
            </div>
          </Specimen>
          <Specimen name="MarketStatusIndicator">
            <div className="flex flex-wrap gap-4">
              {STATUSES.map((status) => (
                <MarketStatusIndicator key={status} status={status} />
              ))}
            </div>
            <Variant label='size="value"'>
              <MarketStatusIndicator status="open" size="value" />
            </Variant>
          </Specimen>
        </div>
      </div>

      <div className={SPECIMEN_GRID}>
        <Specimen name="SecurityLogo">
          <div className="flex flex-wrap items-end gap-4">
            <Variant label='"s"'>
              <SecurityLogo symbol="BAIAAAAA" size="s" />
            </Variant>
            <Variant label='"m"'>
              <SecurityLogo symbol="BFA" brandColor="green" />
            </Variant>
            <Variant label='"l"'>
              <SecurityLogo symbol="ENSA" brandColor="violet" size="l" />
            </Variant>
            <Variant label='"header"'>
              <SecurityLogo symbol="BCGA" brandColor="gold" size="header" />
            </Variant>
            <Variant label="failed image">
              <SecurityLogo symbol="X" logoUrl="data:image/png;base64,AA==" brandColor="red" />
            </Variant>
          </div>
        </Specimen>

        <Specimen name="MarketMetric · FeatureRow">
          <div className="grid grid-cols-2 gap-4">
            <MarketMetric title={t("common.trades")} value="186" detail={t("components.financial.todaySession")} icon="exchange" />
            <MarketMetric title={t("common.change")} value={null} />
          </div>
          <FeatureRow icon="shield-check" title={t("designSystem.gallery.sampleInsightTitle")} subtitle={t("designSystem.gallery.sampleInsightMessage")} />
        </Specimen>
      </div>
    </GallerySection>
  );
}
