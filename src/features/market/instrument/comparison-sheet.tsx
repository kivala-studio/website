"use client";

import type Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  type MarketSecurity,
  type PricePoint,
  type TimeRange,
  TIME_RANGE_DAYS,
  commonObservationInterval,
  hasUsableQuote,
  performancePercent,
  visibleOutsideSearch,
} from "@/domain/market";
import { DAY_MS, startOfDay } from "@/domain/market/zone";
import { useAccount } from "@/features/account/account-provider";
import { authorizeComparison } from "@/features/account/actions";
import { RANGE_OF } from "@/features/chart/ranges";
import { useMarketState, useMarketStore } from "@/features/market/market-provider";
import { cn } from "@/ui/cn";
import { Button } from "@/ui/components/buttons";
import { type TimeRange as RangeName, TimeRangePicker } from "@/ui/components/controls";
import { Dialog } from "@/ui/components/dialog";
import { SecurityLogo } from "@/ui/components/rows";
import { Spinner } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

const RANGES: readonly RangeName[] = ["oneWeek", "oneMonth", "threeMonths", "sixMonths", "oneYear"];
const SERIES = ["text-accent", "text-brand-violet", "text-warning"] as const;
const MAX_INSTRUMENTS = 3;
const WIDTH = 600;
const HEIGHT = 240;

type Series = { security: MarketSecurity; points: { date: number; value: Decimal }[] };

/**
 * Comparar (iOS `ChartComparisonView`): up to three instruments of the same kind as % change from their common
 * start. The server authorises each set (`authorize_chart_comparison`) and owns the Free limits; a set without
 * two shared observations is refused here first, so the free pair is not spent.
 */
export function ComparisonSheet({ open, onClose, base }: { open: boolean; onClose: () => void; base: MarketSecurity }) {
  const t = useTranslations();
  const format = useFormat();
  const account = useAccount();
  const store = useMarketStore();
  const state = useMarketState();
  const [others, setOthers] = useState<string[]>([]);
  const [rangeName, setRangeName] = useState<RangeName>("threeMonths");
  /** Server answers per instrument set (sorted ids): authorised, or a failure that is not a plan limit. */
  const [answers, setAnswers] = useState<Record<string, "ready" | "failed">>({});
  const svg = useRef<SVGSVGElement>(null);
  const titleID = useId();
  const snapshot = state.load.kind === "loaded" ? state.load.snapshot : undefined;
  const at = state.assessedAt ?? 0;
  const range: TimeRange = RANGE_OF[rangeName];

  const candidates = useMemo(
    () =>
      snapshot
        ? visibleOutsideSearch(snapshot.securities, at)
            .filter((security) => security.kind === base.kind && security.id !== base.id && hasUsableQuote(security, at))
            .sort((a, b) => a.symbol.localeCompare(b.symbol))
        : [],
    [snapshot, at, base.kind, base.id],
  );
  const selected = useMemo(() => [base, ...others.flatMap((id) => candidates.find((security) => security.id === id) ?? [])], [base, others, candidates]);
  const ids = selected.map((security) => security.id);
  const key = [...ids].sort().join();

  useEffect(() => {
    if (!open) return;
    for (const id of ids) if (!state.histories[id]) void store.loadHistory(id);
  }, [open, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const histories = ids.map((id) => state.histories[id]);
  const loading = histories.some((history) => history === undefined);
  const days = TIME_RANGE_DAYS[range] ?? 365;
  const interval =
    !loading && selected.length > 1
      ? commonObservationInterval(histories as PricePoint[][], { start: startOfDay(at) - days * DAY_MS, end: at }, true)
      : undefined;

  const series: Series[] = useMemo(() => {
    if (!interval) return [];
    const days = new Set(
      (histories[0] ?? []).filter((point) => point.date >= interval.start && point.date <= interval.end).map((point) => startOfDay(point.date)),
    );
    for (const history of histories.slice(1)) {
      const own = new Set((history ?? []).map((point) => startOfDay(point.date)));
      for (const day of days) if (!own.has(day)) days.delete(day);
    }
    return selected.map((security, index) => {
      const shared = (histories[index] ?? []).filter((point) => days.has(startOfDay(point.date))).sort((a, b) => a.date - b.date);
      const baseline = shared[0]?.value;
      return {
        security,
        points: baseline ? shared.flatMap((point) => {
          const value = performancePercent(point.value, baseline);
          return value ? [{ date: startOfDay(point.date), value }] : [];
        }) : [],
      };
    });
  }, [interval?.start, interval?.end, key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Authorise once per set, after the shared observations are known (iOS: the call spends the Free pair).
  const needsAnswer = open && account !== null && selected.length > 1 && !loading && interval !== undefined && answers[key] === undefined;
  useEffect(() => {
    if (!needsAnswer || !account) return;
    let current = true;
    void authorizeComparison(account.userID, ids).then((result) => {
      if (!current) return;
      if (result.status === "ok") account.applyAccess(result.value);
      const upgrade = result.status === "failed" ? result.error.rule?.upgrade : undefined;
      if (upgrade) {
        setOthers((list) => list.slice(0, -1));
        return account.requestUpgrade(upgrade.reason);
      }
      setAnswers((previous) => ({ ...previous, [key]: result.status === "ok" ? "ready" : "failed" }));
    });
    return () => {
      current = false;
    };
  }, [needsAnswer, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) =>
    setOthers((list) => (list.includes(id) ? list.filter((other) => other !== id) : list.length + 1 < MAX_INSTRUMENTS ? [...list, id] : list));

  const values = series.flatMap((item) => item.points.map((point) => point.value.toNumber()));
  const lower = Math.min(0, ...values);
  const upper = Math.max(0, ...values);
  const span = upper - lower || 1;
  const start = interval?.start ?? 0;
  const width = Math.max((interval?.end ?? 1) - start, 1);
  const x = (date: number) => ((date - start) / width) * WIDTH;
  const y = (value: number) => 12 + (1 - (value - lower) / span) * (HEIGHT - 24);

  const savePNG = async () => {
    const node = svg.current;
    if (!node) return;
    const clone = node.cloneNode(true) as SVGSVGElement;
    const originals = node.querySelectorAll<SVGElement>("path, line, text");
    clone.querySelectorAll<SVGElement>("path, line, text").forEach((element, index) => {
      const style = getComputedStyle(originals[index]);
      element.setAttribute("stroke", style.stroke);
      element.setAttribute("fill", style.fill);
    });
    clone.setAttribute("width", String(WIDTH * 2));
    clone.setAttribute("height", String(HEIGHT * 2));
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
    await image.decode();
    const canvas = Object.assign(document.createElement("canvas"), { width: WIDTH * 2, height: HEIGHT * 2 });
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = getComputedStyle(document.body).backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const name = `invest-ao-${selected.map((security) => security.symbol.toLowerCase()).join("-")}.png`;
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: t("assetDetails.comparison.chartTitle") }).catch(() => undefined);
      return;
    }
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const noCommon = selected.length > 1 && !loading && interval === undefined;
  const ready = answers[key] === "ready" && series.every((item) => item.points.length >= 2);
  return (
    <Dialog open={open} onClose={onClose} title={t("assetDetails.comparison.title", { arg1: base.symbol })}>
      <div className="flex flex-col gap-6 px-5 pt-2 pb-8" data-testid="comparison">
        <TimeRangePicker label={t("assetDetails.comparison.chartTitle")} ranges={RANGES} value={rangeName} onChange={setRangeName} />
        <section aria-labelledby={titleID} className="flex flex-col gap-3">
          <h3 id={titleID} className="text-secondary font-semibold text-primary-text">
            {t("assetDetails.comparison.chartTitle")}
          </h3>
          {selected.length < 2 ? (
            <p className="text-secondary text-secondary-text">{t("assetDetails.comparison.selectInstrument")}</p>
          ) : loading || needsAnswer ? (
            <p className="flex items-center gap-2 text-secondary text-secondary-text" aria-live="polite">
              <Spinner className="size-4" />
              {t("assetDetails.comparison.preparing")}
            </p>
          ) : noCommon ? (
            <p className="text-secondary text-secondary-text" data-testid="comparison-message">
              {t("assetDetails.comparison.noCommonError")}
            </p>
          ) : answers[key] === "failed" ? (
            <p className="text-secondary text-secondary-text" data-testid="comparison-message">
              {t("assetDetails.comparison.confirmError")}
            </p>
          ) : ready ? (
            <>
              <svg
                ref={svg}
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                role="img"
                aria-label={t("assetDetails.accessibility.comparisonChart")}
                className="h-60 w-full overflow-visible"
                data-testid="comparison-chart"
              >
                <line x1={0} x2={WIDTH} y1={y(0)} y2={y(0)} className="stroke-separator" strokeDasharray="3 4" fill="none" />
                {series.map((item, index) => (
                  <path
                    key={item.security.id}
                    d={item.points.map((point, step) => `${step === 0 ? "M" : "L"}${x(point.date).toFixed(2)} ${y(point.value.toNumber()).toFixed(2)}`).join(" ")}
                    className={cn("stroke-current", SERIES[index])}
                    fill="none"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              <ul className="flex flex-col">
                {series.map((item, index) => {
                  const last = item.points.at(-1)?.value;
                  return (
                    <li key={item.security.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-separator last:border-b-0">
                      <span className="flex items-center gap-2 text-body font-semibold text-primary-text">
                        <span aria-hidden className={cn("size-2.5 rounded-full bg-current", SERIES[index])} />
                        {item.security.symbol}
                      </span>
                      <span className="text-body font-semibold text-primary-text tabular-nums">{last ? format.percent(last) : "—"}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-caption text-secondary-text">{t("assetDetails.export.methodNote")}</p>
              <Button kind="secondary" icon="download" className="self-start" onClick={() => void savePNG()} data-testid="comparison-png">
                {t("assetDetails.comparison.shareChart")}
              </Button>
            </>
          ) : null}
        </section>
        <section aria-labelledby={`${titleID}-picker`} className="flex flex-col gap-2">
          <h3 id={`${titleID}-picker`} className="text-secondary font-semibold text-primary-text">
            {t("assetDetails.picker.title")}
          </h3>
          {candidates.length === 0 ? (
            <p className="text-secondary text-secondary-text">{t("assetDetails.picker.emptyMessage")}</p>
          ) : (
            <ul className="flex flex-col">
              {candidates.map((security) => {
                const chosen = others.includes(security.id);
                const full = !chosen && others.length + 1 >= MAX_INSTRUMENTS;
                return (
                  <li key={security.id} className="border-b border-separator last:border-b-0">
                    <button
                      type="button"
                      aria-pressed={chosen}
                      disabled={full}
                      onClick={() => toggle(security.id)}
                      aria-label={t(chosen ? "assetDetails.accessibility.removeInstrument" : "assetDetails.accessibility.addInstrument", { arg1: security.symbol })}
                      className="flex min-h-14 w-full items-center gap-3 rounded-small py-2 text-left disabled:opacity-42"
                      data-testid="comparison-candidate"
                    >
                      <SecurityLogo symbol={security.symbol} logoUrl={security.logoURL} size="s" />
                      <span className="flex-1 text-body font-semibold text-primary-text">{security.symbol}</span>
                      <Icon name={chosen ? "check-circle" : "add"} className={chosen ? "text-accent" : "text-tertiary-text"} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  );
}
