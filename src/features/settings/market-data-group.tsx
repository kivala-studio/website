"use client";

import { useTranslations } from "next-intl";

import { useMarketState } from "@/features/market/market-provider";
import { MarketStatusIndicator } from "@/ui/components/financial";
import { useFormat } from "@/ui/format";

import { SettingsGroup, ValueRow } from "./settings-ui";

/** Dados de mercado: the source, the market's state and the last update of the loaded snapshot. */
export function MarketDataGroup() {
  const t = useTranslations();
  const format = useFormat();
  const state = useMarketState();
  const snapshot = state.load.kind === "loaded" ? state.load.snapshot : null;
  const updated = snapshot?.updatedAt;
  return (
    <SettingsGroup id="market-data" title={t("settings.marketData.title")}>
      <ValueRow label={t("settings.marketData.mainSource")}>BODIVA</ValueRow>
      <ValueRow label={t("settings.marketData.status")}>{snapshot ? <MarketStatusIndicator status={snapshot.status} /> : t("common.waitingForData")}</ValueRow>
      <ValueRow label={t("settings.marketData.lastUpdate")}>
        {updated !== undefined ? format.timestamp(updated) : snapshot ? t("settings.marketData.dateUnavailable") : t("common.waitingForData")}
      </ValueRow>
      <p className="py-3 text-caption text-secondary-text">{t("settings.marketData.disclaimer")}</p>
    </SettingsGroup>
  );
}
