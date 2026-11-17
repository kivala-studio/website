"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { AmountField } from "@/ui/components/amount-field";
import { ActionTile, Button, ButtonLink, IconButton } from "@/ui/components/buttons";
import {
  NavTabs,
  SearchField,
  SectionTabs,
  SegmentedControl,
  ThemeMenu,
  ThemeSwitch,
  type TimeRange,
  TimeRangePicker,
} from "@/ui/components/controls";
import { Dialog } from "@/ui/components/dialog";
import { OfflineBanner, SensitiveValue, ToastHost, useToast } from "@/ui/components/feedback";
import { ChangeBadge, FinancialValue, MarketMetric, MarketStatusIndicator } from "@/ui/components/financial";
import { Card, PAGE_CONTAINER, PageHeading, Panel, SectionHeader, StatStrip } from "@/ui/components/layout";
import { AssetRow, FeatureRow, SecurityLogo } from "@/ui/components/rows";
import { SectionRail } from "@/ui/components/section-rail";
import { DataTable, TableCell, TableHead, TableHeaderCell, TableNameCell, TableRow } from "@/ui/components/table";
import { TopBar } from "@/ui/components/top-bar";
import {
  ChartShimmer,
  EmptyState,
  ErrorState,
  InstrumentRowSkeleton,
  LoadingState,
  SectionPlaceholder,
  Skeleton,
} from "@/ui/components/states";
import { ICON_PACK, type IconName } from "@/ui/icons/icon-pack";
import { Icon } from "@/ui/icons/icon";
import type { Theme } from "@/ui/theme/theme";
import { cn } from "@/ui/cn";

import { FormatCheck } from "./format-check";

// Development-only page. Sample instruments and amounts are illustrative data, not product copy.
// Literal class names so Tailwind generates them; inline styles are blocked by the CSP.
const SWATCHES = [
  "bg-app-background", "bg-elevated-background", "bg-card-background", "bg-action-surface", "bg-accent-soft",
  "bg-selected-tab-background", "bg-widget-background", "bg-primary-text", "bg-secondary-text", "bg-tertiary-text",
  "bg-accent", "bg-on-accent", "bg-positive", "bg-negative", "bg-warning", "bg-separator", "bg-chart-grid",
  "bg-card-outline", "bg-control-outline", "bg-comparison-orange", "bg-comparison-purple",
];
const SAMPLE_ROWS = [
  { symbol: "BAIAAAAA", name: "Banco Angolano de Investimentos", price: "65000", change: "2.14", color: "blue" },
  { symbol: "BFAAAAAA", name: "Banco de Fomento Angola", price: "72500", change: "-0.62", color: "green" },
  { symbol: "ENSAAAAA", name: "ENSA Seguros de Angola", price: "21000", change: "0", color: "violet" },
] as const;
const TYPE_ROLES = [
  "text-headline", "text-display", "text-price", "text-section", "text-body", "text-secondary", "text-caption",
  "text-micro font-bold uppercase",
  "font-display text-display",
  "font-display text-body",
];

function Story({ name, children }: { name: string; children: ReactNode }) {
  const id = `story-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-separator pt-6">
      <h2 id={id} className="text-micro font-bold uppercase text-tertiary-text">{name}</h2>
      {children}
    </section>
  );
}

function ToastDemo() {
  const t = useTranslations();
  const { show } = useToast();
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button kind="secondary" onClick={() => show({ title: t("components.emptyState.dataUnavailable"), message: t("components.placeholder.loadFailed") })}>
        Toast
      </Button>
      <Button
        kind="secondary"
        onClick={() =>
          show({
            title: t("components.emptyState.dataUnavailable"),
            message: t("components.placeholder.loadFailed"),
            actionTitle: t("common.tryAgain"),
            onRetry: () => new Promise((resolve) => setTimeout(resolve, 1200)),
          })
        }
      >
        Toast + {t("common.tryAgain")}
      </Button>
    </div>
  );
}

export function DesignGallery({ initialTheme }: { initialTheme: Theme }) {
  const t = useTranslations();
  const [tab, setTab] = useState(0);
  const [mode, setMode] = useState<"price" | "percent">("price");
  const [range, setRange] = useState<TimeRange>("oneMonth");
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState(true);
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState(14862.34);
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [tile, setTile] = useState(0);

  return (
    <ToastHost>
      <main className={cn(PAGE_CONTAINER, "flex flex-col gap-8 py-8")}>
        <PageHeading title={t("designSystem.gallery.title")} eyebrow={t("designSystem.gallery.previewBadge")} />
        <ThemeSwitch initial={initialTheme} />

        <Story name="Colour">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SWATCHES.map((swatch) => (
              <li key={swatch} className="flex items-center gap-3">
                <span className={`size-8 shrink-0 rounded-small border border-separator ${swatch}`} />
                <code className="text-caption text-secondary-text">{swatch.slice(3)}</code>
              </li>
            ))}
          </ul>
        </Story>

        <Story name="Type">
          {TYPE_ROLES.map((role) => (
            <p key={role} className={`${role} text-primary-text`}>
              {role.replace(" font-bold uppercase", "").replaceAll("text-", "")} 1 234 567,89 · 0 111 888,00
            </p>
          ))}
        </Story>

        <Story name="Icons">
          <ul className="grid grid-cols-4 gap-4 sm:grid-cols-8">
            {(Object.keys(ICON_PACK) as IconName[]).map((name) => (
              <li key={name} className="flex flex-col items-center gap-1 text-center">
                <Icon name={name} scale="l" className="text-primary-text" />
                <span className="text-micro text-tertiary-text">{name}</span>
              </li>
            ))}
          </ul>
        </Story>

        <Story name="Buttons">
          <Button>{t("designSystem.gallery.viewPortfolio")}</Button>
          <Button kind="secondary" icon="refresh">{t("common.tryAgain")}</Button>
          <Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500); }}>
            {t("designSystem.gallery.openActivity")}
          </Button>
          <Button kind="destructive" icon="trash">{t("common.close")}</Button>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="compact">{t("designSystem.gallery.viewPortfolio")}</Button>
            <Button size="compact" kind="secondary" icon="refresh">{t("common.tryAgain")}</Button>
            <ButtonLink size="compact" kind="outline" href="/dev/design">{t("common.viewAll")}</ButtonLink>
          </div>
          <div className="flex gap-3">
            <IconButton icon="share" label="share" />
            <IconButton icon="more" label="more" />
            <IconButton icon="close" label={t("common.close")} />
            <IconButton icon="settings" label={t("common.theme")} variant="plain" />
            <IconButton icon="notification" label={t("common.notifications")} variant="plain" />
          </div>
        </Story>

        <Story name="Top bar">
          <div className="overflow-hidden rounded-large border border-hairline">
            <TopBar
              home={{ href: "/dev/design", label: t("site.header.homeLabel") }}
              logo={<span className="font-display text-section font-semibold">{t("common.appName")}</span>}
              navLabel={t("site.header.navLabel")}
              mobileNav="row"
              nav={[
                { href: "/dev/design", label: t("common.home") },
                { href: "/mercado", label: t("common.explore") },
                { href: "/carteira", label: t("common.portfolio") },
              ]}
              search={<span className="hidden w-full lg:block"><SearchField value={query} onChange={setQuery} placeholder={t("common.search")} hint="/" /></span>}
              actions={
                <>
                  <ThemeMenu initial={initialTheme} />
                  <ButtonLink href="/dev/design" size="compact" className="ml-1">{t("onboarding.navigation.signIn")}</ButtonLink>
                </>
              }
            />
          </div>
        </Story>

        <Story name="Action tiles">
          <div className="grid grid-cols-3 gap-3">
            {(["watchlist", "alert", "exchange"] as const).map((icon, index) => (
              <ActionTile key={icon} icon={icon} title={ICON_PACK[icon].label} selected={tile === index} onClick={() => setTile(index)} />
            ))}
          </div>
        </Story>

        <Story name="Asset rows">
          <div className="flex flex-col divide-y divide-separator">
            <AssetRow symbol="BAIAAAAA" name="Banco Angolano de Investimentos" price="65000" change="2.14" href="/dev/design" />
            <AssetRow symbol="BFAAAAAA" name="Banco de Fomento Angola" price="72500" change="-0.62" brandColor="green" href="/dev/design" />
            <AssetRow symbol="OT-NR-2030" name="Obrigação do Tesouro 2030" price="98.5" change="0" bond brandColor="gold" />
            <AssetRow symbol="ENSAAAAA" name="ENSA Seguros de Angola" price={null} brandColor="violet" />
          </div>
        </Story>

        <Story name="Feature row, card, headers">
          <FeatureRow icon="shield-check" title={t("designSystem.gallery.sampleInsightTitle")} subtitle={t("designSystem.gallery.sampleInsightMessage")} />
          <Card>
            <SectionHeader title={t("designSystem.gallery.valuesHeader")} action={<a href="#story-buttons" className="text-secondary text-accent">{t("common.all")}</a>} />
          </Card>
          <Card surface="elevated" compact>
            <SectionHeader title={t("designSystem.gallery.surface")} />
          </Card>
          <Card
            title={t("designSystem.gallery.valuesHeader")}
            titleId="gallery-card"
            action={<ButtonLink size="compact" kind="outline" href="/dev/design">{t("common.viewAll")}</ButtonLink>}
          >
            <p className="text-body text-secondary-text">{t("designSystem.gallery.sampleInsightMessage")}</p>
          </Card>
        </Story>

        <Story name="Data table">
          <Card title={t("common.market")} titleId="gallery-table" flush action={<ButtonLink size="compact" kind="outline" href="/dev/design">{t("common.viewAll")}</ButtonLink>}>
            <div className="overflow-x-auto">
              <DataTable className="min-w-[32rem]">
                <TableHead>
                  <TableHeaderCell>{t("common.instrument")}</TableHeaderCell>
                  <TableHeaderCell align="right">{t("common.price")}</TableHeaderCell>
                  <TableHeaderCell align="right">{t("common.change")}</TableHeaderCell>
                </TableHead>
                <tbody>
                  {SAMPLE_ROWS.map((row) => (
                    <TableRow key={row.symbol}>
                      <TableNameCell
                        logo={<SecurityLogo symbol={row.symbol} brandColor={row.color} size="s" />}
                        name={row.name}
                        symbol={row.symbol}
                        href="/dev/design"
                      />
                      <TableCell numeric>
                        <FinancialValue value={row.price} digits={0} />
                      </TableCell>
                      <TableCell numeric>
                        <ChangeBadge value={row.change} />
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </DataTable>
            </div>
          </Card>
        </Story>

        <Story name="Panel and statistics strip">
          <Panel title={t("designSystem.gallery.valuesHeader")} always flush>
            <StatStrip
              items={[
                { title: t("common.trades"), value: "186" },
                { title: t("common.change"), value: "+2,14%", tone: "text-positive" },
                { title: t("common.price"), value: "72 500,00 Kz" },
                { title: t("designSystem.gallery.surface"), value: "—" },
              ]}
            />
          </Panel>
        </Story>

        <Story name="Tabs and segmented control">
          <SectionTabs
            label={t("designSystem.gallery.controlsHeader")}
            titles={[t("designSystem.gallery.positive"), t("designSystem.gallery.surface"), t("designSystem.gallery.flowsHeader")]}
            selected={tab}
            onSelect={setTab}
          />
          <SegmentedControl
            label={t("designSystem.layout.comparisonModeAccessibility")}
            value={mode}
            onChange={setMode}
            options={[{ value: "price", title: "Kz" }, { value: "percent", title: "%" }]}
          />
          <TimeRangePicker label={t("components.chart.priceAccessibility")} value={range} onChange={setRange} isEnabled={(value) => value !== "all"} />
          <NavTabs
            label={t("common.portfolio")}
            items={[
              { href: "/dev/design", title: t("legacy.resumo") },
              { href: "/carteira/registos", title: t("common.records") },
              { href: "/carteira/rendimentos", title: t("income.title") },
            ]}
          />
          <SearchField value={query} onChange={setQuery} hint="/" />
        </Story>

        <Story name="Section rail">
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-6">
            <SectionRail
              label={t("common.portfolio")}
              items={[
                { href: "/dev/design", label: t("legacy.resumo"), icon: "portfolio" },
                { href: "/carteira/posicoes", label: t("portfolio.dashboard.positionsTab"), icon: "chart" },
                { href: "/carteira/registos", label: t("common.records"), icon: "history" },
                { href: "/carteira/rendimentos", label: t("income.title"), icon: "dividend" },
                { href: "/simulador", label: t("common.simulateInvestment"), icon: "calculator" },
              ]}
            />
            <Card className="min-h-40">
              <SectionHeader title={t("legacy.resumo")} />
            </Card>
          </div>
        </Story>

        <Story name="Values and change">
          <FinancialValue value={price} style="display" />
          <FinancialValue value="72500" style="price" digits={0} />
          <FinancialValue value="98.5" bond />
          <div className="flex flex-wrap gap-2">
            <ChangeBadge value="2.14" />
            <ChangeBadge value="-0.62" />
            <ChangeBadge value="0" />
          </div>
          <Button kind="secondary" onClick={() => setPrice((value) => Math.round((value + 123.45) * 100) / 100)}>+123,45</Button>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MarketMetric title={t("common.trades")} value="186" detail={t("components.financial.todaySession")} icon="exchange" />
            <MarketMetric title={t("common.change")} value={null} />
          </div>
          <div className="flex flex-wrap gap-4">
            <MarketStatusIndicator status="open" />
            <MarketStatusIndicator status="openingSoon" />
            <MarketStatusIndicator status="closed" />
            <MarketStatusIndicator status="unknown" />
          </div>
          <div className="flex gap-3">
            <SecurityLogo symbol="BAIAAAAA" />
            <SecurityLogo symbol="BFA" brandColor="green" />
            <SecurityLogo symbol="X" logoUrl="data:image/png;base64,AA==" brandColor="red" />
          </div>
        </Story>

        <Story name="States">
          <LoadingState />
          <EmptyState
            title={t("components.emptyState.noFavoritesTitle")}
            message={t("components.emptyState.noFavoritesMessage")}
            icon="watchlist"
            action={<Button kind="secondary" className="w-auto">{t("designSystem.gallery.viewPortfolio")}</Button>}
          />
          <ErrorState message={t("components.placeholder.loadFailed")} action={<Button icon="refresh" className="w-auto">{t("common.tryAgain")}</Button>} />
          <InstrumentRowSkeleton />
          <Skeleton className="h-6 w-40" />
          <ChartShimmer />
          <SectionPlaceholder title={t("designSystem.gallery.valuesHeader")} />
          <SectionPlaceholder title={t("designSystem.gallery.valuesHeader")} failed onRetry={() => undefined} />
        </Story>

        <Story name="Feedback">
          <ToastDemo />
          <OfflineBanner forceVisible />
          <div className="flex items-center gap-4">
            <SensitiveValue hidden={hidden}>
              <FinancialValue value="1250000" digits={0} style="price" />
            </SensitiveValue>
            <IconButton
              icon={hidden ? "eye" : "eye-off"}
              label={hidden ? t("components.privacy.showValues") : t("components.privacy.hideValues")}
              onClick={() => setHidden((value) => !value)}
            />
          </div>
        </Story>

        <Story name="Amount field">
          <label className="flex flex-col gap-2 text-secondary text-secondary-text">
            {t("common.change")}
            <AmountField value={amount} onValueChange={setAmount} suffix="Kz" />
          </label>
        </Story>

        <Story name="Dialog and sheet">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button kind="secondary" onClick={() => setSheet(true)}>Sheet</Button>
            <Button kind="secondary" onClick={() => setDialog(true)}>Dialog</Button>
          </div>
          <Dialog open={sheet} onClose={() => setSheet(false)} title={t("designSystem.gallery.valuesHeader")} footer={<Button onClick={() => setSheet(false)}>{t("designSystem.gallery.viewPortfolio")}</Button>}>
            <AssetRow symbol="BAIAAAAA" name="Banco Angolano de Investimentos" price="65000" change="2.14" />
          </Dialog>
          <Dialog open={dialog} onClose={() => setDialog(false)} title={t("designSystem.gallery.surface")} variant="dialog">
            <p className="text-body">{t("designSystem.gallery.sampleInsightMessage")}</p>
          </Dialog>
        </Story>

        <Story name="Formatting">
          <FormatCheck />
        </Story>
      </main>
    </ToastHost>
  );
}
