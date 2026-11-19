"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { cn } from "@/ui/cn";
import { chipClass } from "@/ui/components/button-styles";
import { Button, IconButton } from "@/ui/components/buttons";
import { SectionTabs, SegmentedControl } from "@/ui/components/controls";
import { Dialog } from "@/ui/components/dialog";
import { useToast } from "@/ui/components/feedback";
import { ChangeBadge, FinancialValue } from "@/ui/components/financial";
import { FlipList } from "@/ui/components/flip-list";
import { Card } from "@/ui/components/layout";
import { Menu, SwitchRow } from "@/ui/components/menu";
import { Collapse, IconSwap } from "@/ui/components/motion";
import { SecurityLogo } from "@/ui/components/rows";
import { EmptyState, InstrumentRowSkeleton } from "@/ui/components/states";
import { Icon } from "@/ui/icons/icon";
import { ICON_PACK } from "@/ui/icons/icon-pack";
import { useEntrance } from "@/ui/motion/use-entrance";
import { useSlidingIndicator } from "@/ui/motion/use-sliding-indicator";

import { GallerySection, SAMPLE_INSTRUMENTS, SPECIMEN_GRID, Specimen, Variant } from "./specimen";

const DURATIONS = ["fast", "base", "slow"] as const;
const EASINGS = ["standard", "emphasized", "exit"] as const;

/** Literal class names, so Tailwind generates them. */
const DURATION_CLASS = { fast: "duration-fast", base: "duration-base", slow: "duration-slow" } as const;
const EASING_CLASS = { standard: "ease-standard", emphasized: "ease-emphasized", exit: "ease-exit" } as const;

const subscribeReduced = (listener: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

function useTokenValue(name: string) {
  return useSyncExternalStore(
    () => () => {},
    () => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    () => "",
  );
}

/** A dot that crosses its track with one duration and one curve. */
function Track({ on, duration, easing }: { on: boolean; duration: (typeof DURATIONS)[number]; easing: (typeof EASINGS)[number] }) {
  return (
    <span aria-hidden className="@container block h-4 w-full rounded-full bg-track">
      <span
        className={cn(
          "block size-4 rounded-full bg-accent transition-[translate] motion-reduce:transition-none",
          DURATION_CLASS[duration],
          EASING_CLASS[easing],
          on && "translate-x-[calc(100cqw-1rem)]",
        )}
      />
    </span>
  );
}

function Tokens() {
  const [on, setOn] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const values = {
    fast: useTokenValue("--duration-fast"),
    base: useTokenValue("--duration-base"),
    slow: useTokenValue("--duration-slow"),
    standard: useTokenValue("--ease-standard"),
    emphasized: useTokenValue("--ease-emphasized"),
    exit: useTokenValue("--ease-exit"),
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button kind="secondary" size="compact" icon="refresh" onClick={() => setOn((value) => !value)}>
          Play
        </Button>
        <code className="text-caption text-secondary-text">{`prefers-reduced-motion: ${reduced ? "reduce" : "no-preference"}`}</code>
      </div>
      <div className={SPECIMEN_GRID}>
        <Specimen name="duration-* · ease-emphasized">
          {DURATIONS.map((duration) => (
            <Variant key={duration} label={`duration-${duration} · --duration-${duration}: ${values[duration]}`} className="items-stretch">
              <Track on={on} duration={duration} easing="emphasized" />
            </Variant>
          ))}
        </Specimen>
        <Specimen name="ease-* · duration-slow">
          {EASINGS.map((easing) => (
            <Variant key={easing} label={`ease-${easing} · ${values[easing]}`} className="items-stretch">
              <Track on={on} duration="slow" easing={easing} />
            </Variant>
          ))}
        </Specimen>
      </div>
    </div>
  );
}

/** A single-choice chip group whose fill glides: `chipClass` + `useSlidingIndicator` on the group. */
function GlidingChips() {
  const [preset, setPreset] = useState("10");
  const group = useSlidingIndicator<HTMLDivElement>(preset, { selector: '[aria-pressed="true"]' });
  return (
    <div ref={group} role="group" aria-label="Preset sample" className="flex flex-wrap gap-2">
      {["5", "10", "20", "50"].map((value) => (
        <button key={value} type="button" aria-pressed={preset === value} onClick={() => setPreset(value)} className={chipClass(preset === value)}>
          {`${value} %`}
        </button>
      ))}
    </div>
  );
}

/** Content that replaces a skeleton fades in: it mounts after hydration, so `useEntrance` lets it. */
function LoadedRow() {
  const entrance = useEntrance();
  const [first] = SAMPLE_INSTRUMENTS;
  return (
    <div className={cn("flex min-h-20 items-center gap-3 py-3", entrance && "motion-fade-in")}>
      <SecurityLogo symbol={first.symbol} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-display text-body font-semibold text-primary-text">{first.symbol}</span>
        <span className="truncate text-secondary text-secondary-text">{first.name}</span>
      </span>
      <ChangeBadge value={first.change} />
    </div>
  );
}

const LIST = SAMPLE_INSTRUMENTS.map((item) => item.symbol);

export function MotionSection() {
  const t = useTranslations();
  const { show } = useToast();
  const [mode, setMode] = useState<"price" | "percent">("price");
  const [tab, setTab] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [alerts, setAlerts] = useState(true);
  const [price, setPrice] = useState(65000);
  const [change, setChange] = useState(2.14);
  const [order, setOrder] = useState<string[]>([...LIST]);
  const [loading, setLoading] = useState<"idle" | "loading" | "loaded" | "empty">("idle");
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const tabs = [t("assetDetails.tab.overview"), t("common.about"), t("assetDetails.tab.orders")];

  const tick = (direction: 1 | -1) => {
    setPrice((value) => value + direction * 250);
    setChange((value) => Math.round((value + direction * 0.37) * 100) / 100);
  };
  const load = (result: "loaded" | "empty") => {
    setLoading("loading");
    setTimeout(() => setLoading(result), 900);
  };

  return (
    <GallerySection id="motion" title="Motion">
      <Tokens />

      <div className={SPECIMEN_GRID}>
        <Specimen name="useSlidingIndicator: segments, tabs, chips">
          <SegmentedControl
            label={t("designSystem.layout.comparisonModeAccessibility")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "price", title: "Kz" },
              { value: "percent", title: "%" },
            ]}
          />
          <SectionTabs label="Motion tabs sample" titles={tabs} selected={tab} onSelect={setTab} />
          <GlidingChips />
        </Specimen>

        <Specimen name="motion-press · motion-lift · motion-tap">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="compact">{t("common.recordPurchase")}</Button>
            <Button size="compact" kind="outline">
              {t("common.viewAll")}
            </Button>
            <IconButton icon="share" label={ICON_PACK.share.label} />
          </div>
          <a href="#motion" className="motion-lift panel flex items-center gap-3 p-4 hover:border-field-border">
            <Icon name="chart" scale="l" className="text-accent" />
            <span className="font-display text-body font-semibold text-primary-text">{t("unusualActivity.title")}</span>
          </a>
          <a href="#motion" className="motion-tap flex min-h-12 items-center gap-3 rounded-small px-2 hover:bg-action-surface">
            <Icon name="news" className="text-secondary-text" />
            <span className="text-body text-primary-text">{t("common.news")}</span>
          </a>
        </Specimen>
      </div>

      <div className={SPECIMEN_GRID}>
        <Specimen name="IconSwap · IconButton icon change · motion-appear">
          <div className="flex flex-wrap items-center gap-6">
            <Variant label="IconSwap turn">
              <button
                type="button"
                aria-label={t("site.header.menuLabel")}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((value) => !value)}
                className="motion-press inline-flex size-12 items-center justify-center rounded-full hover:bg-action-surface"
              >
                <IconSwap icons={["menu", "close"]} show={menuOpen ? 1 : 0} turn scale="l" />
              </button>
            </Variant>
            <Variant label="IconButton icon={…}">
              <IconButton
                icon={hidden ? "eye-off" : "eye"}
                label={hidden ? t("components.privacy.showValues") : t("components.privacy.hideValues")}
                onClick={() => setHidden((value) => !value)}
              />
            </Variant>
            <Variant label="motion-appear data-hidden">
              <button
                type="button"
                aria-label={t("common.activity")}
                onClick={() => setUnread((value) => !value)}
                className="motion-press relative inline-flex size-12 items-center justify-center rounded-full hover:bg-action-surface"
              >
                <Icon name="notification" scale="l" />
                <span aria-hidden data-hidden={unread ? undefined : true} className="motion-appear absolute top-2 right-2 size-2.5 rounded-full bg-negative ring-2 ring-app-background" />
              </button>
            </Variant>
          </div>
          <SwitchRow label={t("common.notifications")} checked={alerts} onChange={setAlerts} />
        </Specimen>

        <Specimen name="Collapse · motion-details · motion-turn">
          <div className="flex flex-col divide-y divide-hairline">
            <div>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls="motion-collapse"
                onClick={() => setExpanded((value) => !value)}
                className="group motion-tap flex min-h-12 w-full items-center gap-3 text-left"
              >
                <span className="flex-1 text-body text-primary-text">{t("common.about")}</span>
                <Icon name="chevron-down" scale="s" className="motion-turn text-tertiary-text group-aria-expanded:rotate-180" />
              </button>
              <Collapse id="motion-collapse" open={expanded} className="pb-4">
                <p className="text-secondary text-secondary-text">{t("designSystem.gallery.sampleInsightMessage")}</p>
              </Collapse>
            </div>
            <details className="group motion-details">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                <span className="flex-1 text-body text-primary-text">{t("common.news")}</span>
                <Icon name="chevron-down" scale="s" className="motion-turn text-tertiary-text group-open:rotate-180" />
              </summary>
              <p className="pb-4 text-secondary text-secondary-text">{t("designSystem.gallery.sampleInsightMessage")}</p>
            </details>
          </div>
        </Specimen>
      </div>

      <div className={SPECIMEN_GRID}>
        <Specimen name="AnimatedText: FinancialValue · ChangeBadge">
          <div className="flex items-center gap-4">
            <FinancialValue value={String(price)} style="price" />
            <ChangeBadge value={String(change)} />
          </div>
          <div className="flex gap-3">
            <Button kind="secondary" size="compact" icon="arrow-up" onClick={() => tick(1)}>
              Tick up
            </Button>
            <Button kind="secondary" size="compact" icon="arrow-down" onClick={() => tick(-1)}>
              Tick down
            </Button>
          </div>
        </Specimen>

        <Specimen name="FlipList">
          <div className="flex flex-wrap gap-3">
            <Button kind="secondary" size="compact" icon="refresh" onClick={() => setOrder((items) => [...items.slice(1), items[0]])}>
              Rotate
            </Button>
            <Button kind="secondary" size="compact" icon="add" onClick={() => setOrder((items) => (items.length < LIST.length ? [...LIST] : items.slice(0, -1)))}>
              Add · remove
            </Button>
          </div>
          <FlipList className="flex flex-col divide-y divide-hairline">
            {order.map((symbol) => {
              const item = SAMPLE_INSTRUMENTS.find((sample) => sample.symbol === symbol)!;
              return (
                <li key={symbol} data-flip-key={symbol} className="flex min-h-14 items-center gap-3 bg-app-background">
                  <SecurityLogo symbol={item.symbol} size="s" brandColor={item.color} />
                  <span className="flex-1 font-display text-body font-medium text-primary-text">{item.symbol}</span>
                  <ChangeBadge value={item.change} />
                </li>
              );
            })}
          </FlipList>
        </Specimen>
      </div>

      <div className={SPECIMEN_GRID}>
        <Specimen name="Skeleton → content · state swap (useEntrance)">
          <div className="flex gap-3">
            <Button kind="secondary" size="compact" onClick={() => load("loaded")}>
              Load
            </Button>
            <Button kind="secondary" size="compact" onClick={() => load("empty")}>
              Load empty
            </Button>
          </div>
          <Card compact className="min-h-28">
            {loading === "loading" ? (
              <InstrumentRowSkeleton />
            ) : loading === "loaded" ? (
              <LoadedRow />
            ) : loading === "empty" ? (
              <EmptyState title={t("components.emptyState.noFavoritesTitle")} icon="watchlist" />
            ) : null}
          </Card>
        </Specimen>

        <Specimen name="Overlays: motion-sheet · motion-modal · motion-pop · toast">
          <div className="flex flex-wrap gap-3">
            <Button kind="secondary" size="compact" onClick={() => setSheet(true)}>
              Sheet
            </Button>
            <Button kind="secondary" size="compact" onClick={() => setDialog(true)}>
              Dialog
            </Button>
            <Menu
              label={t("markets.picker.sortBy")}
              align="start"
              trigger={
                <>
                  {t("markets.picker.sortBy")}
                  <Icon name="chevron-down" scale="s" className="motion-turn group-aria-expanded:rotate-180" />
                </>
              }
              entries={[
                { kind: "check", label: t("common.instrument"), checked: mode === "price", onToggle: () => setMode("price") },
                { kind: "check", label: t("common.price"), checked: mode === "percent", onToggle: () => setMode("percent") },
              ]}
            />
            <Button
              kind="secondary"
              size="compact"
              onClick={() => show({ title: t("components.emptyState.dataUnavailable"), message: t("components.placeholder.loadFailed") })}
            >
              Toast
            </Button>
          </div>
          <Dialog open={sheet} onClose={() => setSheet(false)} title={t("designSystem.gallery.valuesHeader")}>
            <p className="text-body">{t("designSystem.gallery.sampleInsightMessage")}</p>
          </Dialog>
          <Dialog open={dialog} onClose={() => setDialog(false)} title={t("designSystem.gallery.surface")} variant="dialog">
            <p className="text-body">{t("designSystem.gallery.sampleInsightMessage")}</p>
          </Dialog>
        </Specimen>
      </div>
    </GallerySection>
  );
}
