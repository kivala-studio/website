"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { cn } from "@/ui/cn";
import { ActionTile, Button, ButtonLink, IconButton } from "@/ui/components/buttons";
import { buttonClass, chipClass, type ButtonKind } from "@/ui/components/button-styles";
import { SegmentedControl, ThemeMenu, ThemeSwitch, type TimeRange, TimeRangePicker } from "@/ui/components/controls";
import { SectionChip } from "@/ui/components/layout";
import { SwitchRow } from "@/ui/components/menu";
import { ICON_PACK } from "@/ui/icons/icon-pack";
import type { Theme } from "@/ui/theme/theme";

import { FORCED_RING, GallerySection, SPECIMEN_GRID, Specimen, Variant } from "./specimen";

const KINDS: readonly ButtonKind[] = ["primary", "secondary", "outline", "destructive"];
const PRESETS = ["5", "10", "20"] as const;

export function Choices({ initialTheme }: { initialTheme: Theme }) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"price" | "percent">("price");
  const [plan, setPlan] = useState<"month" | "year">("year");
  const [range, setRange] = useState<TimeRange>("oneMonth");
  const [chartRange, setChartRange] = useState<TimeRange>("oneWeek");
  const [preset, setPreset] = useState<string>("10");
  const [tile, setTile] = useState(0);
  const [alerts, setAlerts] = useState(true);
  const [digest, setDigest] = useState(false);
  const label = t("designSystem.gallery.viewPortfolio");

  return (
    <GallerySection id="buttons" title="Buttons and choices">
      <div className={SPECIMEN_GRID}>
        <Specimen name='Button size="regular"'>
          {KINDS.map((kind) => (
            <Variant key={kind} label={`kind="${kind}"`} className="items-stretch">
              <Button kind={kind} icon={kind === "destructive" ? "trash" : undefined}>
                {kind === "destructive" ? t("common.deleteAccount") : label}
              </Button>
            </Variant>
          ))}
          <Variant label="loading" className="items-stretch">
            <Button
              loading={loading}
              onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 1500);
              }}
            >
              {t("designSystem.gallery.openActivity")}
            </Button>
          </Variant>
          <Variant label="disabled" className="items-stretch">
            <Button disabled>{label}</Button>
          </Variant>
          <Variant label="focus" className="items-stretch">
            <Button kind="secondary" className={FORCED_RING}>
              {label}
            </Button>
          </Variant>
          <Variant label='className="w-auto!"'>
            <Button icon="add" className="w-auto!">
              {t("common.recordPurchase")}
            </Button>
          </Variant>
        </Specimen>

        <div className="flex flex-col gap-10">
          <Specimen name='Button size="compact" · ButtonLink · buttonClass'>
            <div className="flex flex-wrap items-center gap-3">
              {KINDS.map((kind) => (
                <Button key={kind} kind={kind} size="compact">
                  {kind}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="compact" icon="add">
                {t("common.recordPurchase")}
              </Button>
              <ButtonLink size="compact" kind="secondary" icon="calculator" href="/dev/design">
                {t("common.simulateInvestment")}
              </ButtonLink>
              <ButtonLink size="compact" kind="outline" href="/dev/design">
                {t("common.viewAll")}
              </ButtonLink>
              <Button size="compact" disabled>
                disabled
              </Button>
              <a href="#buttons" className={buttonClass("outline", FORCED_RING, "compact")}>
                focus
              </a>
            </div>
          </Specimen>

          <Specimen name='Button size="large" (hero calls to action)'>
            <div className="flex flex-wrap items-center gap-3 rounded-card bg-canvas p-4">
              <ButtonLink size="large" href="/dev/design" icon="download">
                {t("common.recordPurchase")}
              </ButtonLink>
              <ButtonLink size="large" kind="secondary" href="/dev/design">
                {t("common.viewAll")}
              </ButtonLink>
            </div>
          </Specimen>

          <Specimen name="IconButton">
            <div className="flex flex-wrap items-end gap-6">
              <Variant label='"filled"'>
                <IconButton icon="share" label={ICON_PACK.share.label} />
              </Variant>
              <Variant label='"surface" (on the canvas)'>
                <span className="rounded-full bg-canvas p-2">
                  <IconButton icon="settings" label={t("common.theme")} variant="surface" />
                </span>
              </Variant>
              <Variant label='"plain"'>
                <IconButton icon="notification" label={t("common.notifications")} variant="plain" />
              </Variant>
              <Variant label='"outline"'>
                <IconButton icon="arrow-down" label={t("common.change")} variant="outline" />
              </Variant>
              <Variant label="disabled">
                <IconButton icon="refresh" label={t("common.refresh")} disabled />
              </Variant>
              <Variant label="focus">
                <IconButton icon="more" label={ICON_PACK.more.label} className={FORCED_RING} />
              </Variant>
            </div>
          </Specimen>

          <Specimen name="chipClass (aria-pressed)">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((value) => (
                <button key={value} type="button" aria-pressed={preset === value} onClick={() => setPreset(value)} className={chipClass(preset === value)}>
                  {`${value} %`}
                </button>
              ))}
              <button type="button" disabled aria-pressed={false} className={chipClass(false)}>
                50 %
              </button>
            </div>
          </Specimen>

          <Specimen name="SectionChip">
            <div className="flex flex-wrap items-center gap-3 rounded-card bg-canvas p-4">
              <SectionChip icon="chart">{t("common.market")}</SectionChip>
              <SectionChip>{t("common.news")}</SectionChip>
            </div>
            <Variant label='tone="soft" (on a card)'>
              <SectionChip tone="soft" icon="portfolio">
                {t("common.portfolio")}
              </SectionChip>
            </Variant>
          </Specimen>

          <Specimen name="ActionTile">
            <div className="grid grid-cols-3 gap-3">
              {(["watchlist", "alert", "exchange"] as const).map((icon, index) => (
                <ActionTile key={icon} icon={icon} title={ICON_PACK[icon].label} selected={tile === index} onClick={() => setTile(index)} />
              ))}
            </div>
          </Specimen>
        </div>
      </div>

      <div className={SPECIMEN_GRID}>
        <Specimen name="SegmentedControl">
          <SegmentedControl
            label={t("designSystem.layout.comparisonModeAccessibility")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "price", title: "Kz" },
              { value: "percent", title: "%" },
            ]}
          />
          <Variant label="ThemeSwitch" className="items-stretch">
            <ThemeSwitch initial={initialTheme} />
          </Variant>
          <Variant label="trailing (a saving)" className="items-stretch">
            <SegmentedControl
              label="Plan"
              value={plan}
              onChange={setPlan}
              options={[
                { value: "month", title: "1 mês" },
                {
                  value: "year",
                  title: "12 meses",
                  spoken: "12 meses, Poupa 16%",
                  trailing: <span className="rounded-full bg-accent-soft px-2 py-0.5 text-caption font-semibold text-accent">−16%</span>,
                },
              ]}
            />
          </Variant>
        </Specimen>

        <Specimen name="TimeRangePicker">
          <Variant label='variant="ranges" · "all" disabled' className="items-stretch">
            <TimeRangePicker label={t("components.chart.priceAccessibility")} value={range} onChange={setRange} isEnabled={(value) => value !== "all"} />
          </Variant>
          <Variant label='variant="segmented"' className="items-stretch">
            <TimeRangePicker variant="segmented" label={t("assetDetails.accessibility.priceHistory")} value={chartRange} onChange={setChartRange} />
          </Variant>
        </Specimen>
      </div>

      <div className={SPECIMEN_GRID}>
        <Specimen name="SwitchRow">
          <div className={cn("flex flex-col divide-y divide-hairline")}>
            <SwitchRow label={t("common.notifications")} checked={alerts} onChange={setAlerts} />
            <SwitchRow label={t("common.activity")} checked={digest} onChange={setDigest} />
            <SwitchRow label={t("common.news")} checked={false} onChange={() => undefined} disabled />
          </div>
        </Specimen>

        <Specimen name="ThemeMenu">
          <ThemeMenu initial={initialTheme} />
        </Specimen>
      </div>
    </GallerySection>
  );
}
