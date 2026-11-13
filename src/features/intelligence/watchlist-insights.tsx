"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import type { Translate } from "@/domain/format";
import type { Insight } from "@/domain/intelligence/models";
import { allows, privacyClassification } from "@/domain/intelligence/privacy";
import { type FeedbackScope, type PersonalizationSurface, feedbackMatches, insightCandidate, observedAt } from "@/domain/personalisation";
import { insightComposition, localizeComposition } from "@/domain/product-voice";
import { personalisationSession } from "@/data/personalisation/personalisation";
import { useMarketState } from "@/features/market/market-provider";
import { usePrivacyMode } from "@/features/privacy/privacy-mode";
import { Link } from "@/i18n/navigation";
import { Dialog } from "@/ui/components/dialog";
import { SectionHeader } from "@/ui/components/layout";
import { Menu } from "@/ui/components/menu";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { useIntelligence, useNow, useWatchlistReading } from "./reading";
import { watchlistPresentation } from "./presentation";

export function useTranslate(): Translate {
  const t = useTranslations();
  return useCallback((key, values) => t(key as never, values as never), [t]);
}

/** Symbol per instrument id, from the loaded market. */
export function useSymbols(): ReadonlyMap<string, string> {
  const market = useMarketState();
  const securities = market.load.kind === "loaded" ? market.load.snapshot.securities : null;
  return useMemo(() => new Map((securities ?? []).map((security) => [security.id, security.symbol])), [securities]);
}

/** "Leitura da semana" at the bottom of the list (iOS `WatchlistInsightSection`): at most two observations. */
export function WatchlistInsights() {
  const t = useTranslate();
  const format = useFormat();
  const symbols = useSymbols();
  const intelligence = useIntelligence();
  const reading = useWatchlistReading();
  const [open, setOpen] = useState<Insight | null>(null);
  if (!intelligence || reading.insights.length === 0) return open ? <InsightDetail insight={open} surface="watchlist" onClose={() => setOpen(null)} /> : null;
  const { coordinator } = intelligence;
  const show = (insight: Insight) => {
    setOpen(insight);
    void coordinator.consume(insight, "watchlist");
  };

  return (
    <section aria-labelledby="watchlist-reading" className="flex flex-col gap-3 pt-6" data-testid="watchlist-reading">
      <SectionHeader id="watchlist-reading" title={t("common.weeklyReview")} />
      {reading.savedAt !== null ? (
        <p className="text-caption text-secondary-text">{t("intelligence.cachedInsight.savedNotice", { arg1: format.timestamp(reading.savedAt) })}</p>
      ) : null}
      <ul className="flex flex-col rounded-large border-[length:var(--card-outline-width)] border-card-outline bg-card-background">
        {reading.insights.map((insight, index) => {
          const item = watchlistPresentation(insight, symbols, format, t);
          return (
            <li key={insight.id} className={index > 0 ? "border-t border-separator" : undefined} data-testid="watchlist-insight" data-type={insight.type}>
              <div className="flex items-start gap-1 py-3 pr-2 pl-4">
                <button type="button" onClick={() => show(insight)} className="flex min-h-11 flex-1 items-start gap-3 rounded-small text-left">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-small bg-accent-soft text-accent">
                    <Icon name={item.icon} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-caption text-secondary-text">{item.summaryTitle}</span>
                    <span className="text-body font-semibold text-primary-text tabular-nums">{item.headline}</span>
                    <span className="text-caption whitespace-pre-line text-secondary-text">{item.context}</span>
                  </span>
                </button>
                <Menu
                  label={t("watchlist.accessibility.insightOptions", { arg1: item.headline })}
                  testID="watchlist-insight-menu"
                  entries={[
                    { kind: "item", label: t("watchlist.menu.viewSources"), icon: "info", onSelect: () => show(insight) },
                    {
                      kind: "item",
                      label: t("watchlist.menu.dismissInsight"),
                      icon: "close",
                      onSelect: () => void coordinator.consume(insight, "watchlist"),
                      testID: "watchlist-insight-dismiss",
                    },
                  ]}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {reading.partial ? <p className="text-caption text-secondary-text">{t("watchlist.insight.sourcesUnavailable")}</p> : null}
      {open ? <InsightDetail insight={open} surface="watchlist" onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

/** The observation sheet (iOS `WatchlistInsightDetails`): what was measured, from which closes, and when. */
export function InsightDetail({ insight, surface, onClose }: { insight: Insight; surface: PersonalizationSurface; onClose: () => void }) {
  const t = useTranslate();
  const format = useFormat();
  const locale = useLocale();
  const symbols = useSymbols();
  const intelligence = useIntelligence();
  const hides = usePrivacyMode();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const userID = intelligence?.state.userID ?? null;
  const visible = allows({ surface: "inApp", privacyEnabled: hides }, privacyClassification(insight));
  const base = watchlistPresentation(insight, symbols, format, t);
  const voice = useMemo(() => {
    if (!intelligence) return null;
    const composition = insightComposition(insight, intelligence.coordinator.voice, { symbols: Object.fromEntries(symbols), surface, format, t });
    return composition ? localizeComposition(composition, locale === "en" ? "en" : "pt", t) : null;
  }, [insight, intelligence, symbols, surface, format, t, locale]);
  const headline = voice?.title ?? base.headline;
  const context = voice?.body ?? base.context;

  const renderedAt = useNow(null);
  const candidate = (now: number) =>
    insightCandidate(
      insight,
      {
        now,
        heldIDs: new Set(),
        watchedIDs: new Set(insight.relatedAssetIDs),
        availableAssetIDs: new Set(symbols.keys()),
        hidesPersonalValues: hides,
      },
      surface,
    );
  const hasFeedback = personalisationSession.exposure.feedback.some((feedback) => feedbackMatches(feedback, candidate(renderedAt), surface));
  const save = async (scope: FeedbackScope | null) => {
    if (!userID || hides || saving) return;
    const target = candidate(Date.now());
    if (target.rejection) return setMessage(t("watchlist.insightDetail.staleMessage"));
    setSaving(true);
    const applied = await personalisationSession.setFeedback(target, scope, surface, userID);
    setSaving(false);
    if (personalisationSession.userID !== userID) return;
    setMessage(
      applied ? t(scope ? "watchlist.insightDetail.preferenceApplied" : "watchlist.insightDetail.preferenceReset") : t("watchlist.insightDetail.applyError"),
    );
  };

  return (
    <Dialog open onClose={onClose} title={t("watchlist.insightDetail.title")}>
      <div className="flex flex-col gap-6" data-testid="insight-detail">
        {message ? (
          <p role="status" className="text-caption text-secondary-text" data-testid="insight-feedback">
            {message}
          </p>
        ) : null}
        {visible ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-3">
                <p className="text-caption font-medium text-accent">{base.title}</p>
                <p className="text-headline text-primary-text">{headline}</p>
                <p className="text-secondary whitespace-pre-line text-secondary-text">{context}</p>
              </div>
              {userID && !hides ? (
                <Menu
                  label={t("watchlist.insightDetail.preferences")}
                  testID="insight-preferences"
                  entries={[
                    {
                      kind: "item",
                      label: t("watchlist.insightDetail.notUseful"),
                      onSelect: () => void save("fact"),
                      disabled: saving,
                      testID: "insight-not-useful",
                    },
                    { kind: "item", label: t("watchlist.insightDetail.showFewer"), onSelect: () => void save("familyOnSurface"), disabled: saving },
                    ...(hasFeedback
                      ? [{ kind: "item" as const, label: t("watchlist.insightDetail.resetPreference"), onSelect: () => void save(null), disabled: saving }]
                      : []),
                  ]}
                />
              ) : null}
            </div>
            <p className="text-body text-primary-text">{base.explanation}</p>
            <p className="flex items-center gap-2 text-caption text-secondary-text">
              <Icon name="history" />
              {t("watchlist.insightDetail.dataAsOf", { arg1: format.timestamp(observedAt(insight)) })}
            </p>
            <hr className="border-separator" />
            {insight.fact.kind === "watchlistInformation" ? (
              <div className="flex flex-col gap-2">
                {intelligence?.state.slugs[insight.fact.value.articleID] ? (
                  <Link
                    href={`/noticias/${intelligence.state.slugs[insight.fact.value.articleID]}`}
                    className="inline-flex min-h-11 items-center text-body text-accent"
                  >
                    {t("watchlist.insightDetail.readPublication")}
                  </Link>
                ) : null}
                <a
                  href={insight.fact.value.primarySourceURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-body text-accent"
                >
                  {t("common.sourceLabel", { arg1: insight.fact.value.sourceName })}
                </a>
              </div>
            ) : (
              <ObservationSources insight={insight} symbols={symbols} />
            )}
            <p className="text-caption text-secondary-text">{t("common.verifiedOn", { arg1: format.timestamp(insight.provenance.fetchedAt) })}</p>
          </>
        ) : (
          <p className="text-body text-primary-text">{t("watchlist.insightDetail.privacyHidden")}</p>
        )}
      </div>
    </Dialog>
  );
}

/** Verified closes behind a price fact, one row per close, with the source records nested (iOS `WatchlistObservationSources`). */
function ObservationSources({ insight, symbols }: { insight: Insight; symbols: ReadonlyMap<string, string> }) {
  const t = useTranslate();
  const format = useFormat();
  const rows = [...insight.provenance.observations].sort((a, b) => a.observedAt - b.observedAt || (a.assetID < b.assetID ? -1 : 1));
  return (
    <details className="group flex flex-col gap-3" data-testid="insight-sources">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-body font-semibold text-primary-text">
        {t("watchlist.sources.verifiedCloses", { arg1: String(rows.length) })}
        <Icon name="chevron-down" className="transition-transform group-open:rotate-180" />
      </summary>
      <p className="text-caption text-secondary-text">{t("watchlist.sources.closesDescription")}</p>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.recordID} className="flex items-baseline justify-between gap-3 border-t border-separator py-2 text-secondary">
            <span className="text-primary-text">
              {symbols.get(row.assetID) ?? t("common.watchedSecurity")} · {format.date(row.observedAt)}
            </span>
            <span className="tabular-nums text-primary-text">
              {format.price(row.price)} {row.currencyCode}
            </span>
          </li>
        ))}
      </ul>
      <details className="flex flex-col gap-2">
        <summary className="flex min-h-11 cursor-pointer items-center text-secondary text-accent">{t("watchlist.sources.recordDetails")}</summary>
        <ul className="flex flex-col gap-2 text-caption text-secondary-text select-text">
          {rows.map((row) => (
            <li key={row.recordID} className="flex flex-col">
              <span>{t("watchlist.sources.record", { arg1: row.recordID })}</span>
              <span>{t("watchlist.sources.collectedOn", { arg1: format.timestamp(row.collectedAt) })}</span>
            </li>
          ))}
        </ul>
      </details>
    </details>
  );
}
