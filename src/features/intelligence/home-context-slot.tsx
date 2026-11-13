"use client";

import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { allows as featureAllows } from "@/domain/intelligence/feature-controls";
import { type HomeContextFeature, type HomeContextOffer, resolveHomeContext } from "@/domain/intelligence/home-context";
import type { Insight } from "@/domain/intelligence/models";
import { allows, privacyClassification } from "@/domain/intelligence/privacy";
import type { MarketCalendar } from "@/domain/market";
import { type DiscoverSelection, receiptKeys, selectDiscover, watchlistInsightCandidates } from "@/domain/personalisation";
import { weekAheadText } from "@/domain/week-ahead/presentation";
import { isFreshBatch, isReplayableBatch, isWeekAheadSunday, nextWeek, selectWeek, semanticKey, weekAheadOffer } from "@/domain/week-ahead/week-ahead";
import { personalisationSession } from "@/data/personalisation/personalisation";
import { useAccount } from "@/features/account/account-provider";
import { readAccountRoute } from "@/features/account/results";
import { useMarketState } from "@/features/market/market-provider";
import { usePrivacyMode } from "@/features/privacy/privacy-mode";
import { WeekAheadStore, decodeWeekAhead } from "@/features/week-ahead/week-ahead-store";
import { Link } from "@/i18n/navigation";
import { useOnline } from "@/ui/components/feedback";
import { useFormat } from "@/ui/format";
import { Icon, type IconName } from "@/ui/icons/icon";

import { useIntelligence, useNow } from "./reading";
import { portfolioTiles, watchlistPresentation } from "./presentation";
import { InsightDetail, useSymbols, useTranslate } from "./watchlist-insights";

/*
 * The Home context slot (iOS `HomeContextCard`, `SaturdayDiscoverSection`): Saturday's Discover list, otherwise the
 * one card `resolveHomeContext` picks. Never an amount or a quantity; privacy mode drops every personal row.
 * The Friday Wrap card needs a weekly Wrap source, which does not exist yet, so Friday after the close stays empty.
 */

const unexpired = (now: number) => (insight: Insight) => now < insight.expiresAt;

export function HomeContextSlot({ fallback }: { fallback: ReactNode }) {
  const t = useTranslate();
  const format = useFormat();
  const symbols = useSymbols();
  const intelligence = useIntelligence();
  const market = useMarketState();
  const hides = usePrivacyMode();
  const online = useOnline();
  const calendar = market.calendar;
  const now = useNow(intelligence?.coordinator.nextExpiry() ?? null);
  const weekAhead = useWeekAheadOffer(now, calendar);
  const [open, setOpen] = useState<Insight | null>(null);

  const state = intelligence?.state;
  const availability = state?.availability ?? null;
  const ready = state && availability && calendar && state.userID === personalisationSession.userID ? state : null;
  const watched = ready?.watchedIDs ?? new Set<string>();
  const held = new Set((ready?.transactions ?? []).filter((item) => item.kind !== "income").map((item) => item.securityId));

  const discover: DiscoverSelection[] =
    ready && calendar && featureAllows(availability!, "saturday_discover")
      ? selectDiscover(
          ready.combined.filter(unexpired(now)).filter((insight) => allows({ surface: "inApp", privacyEnabled: hides }, privacyClassification(insight))),
          {
            now,
            marketState: calendar.state(now),
            calendarValidUntil: calendar.validUntil,
            heldIDs: held,
            watchedIDs: watched,
            availableAssetIDs: new Set(symbols.keys()),
            consumedKeys: ready.consumed,
            hidesPersonalValues: hides,
            profile: personalisationSession.profile(held, watched),
            exposure: personalisationSession.exposure,
          },
          5,
        )
      : [];

  const feature: HomeContextFeature | null =
    ready && calendar && discover.length === 0
      ? resolveHomeContext(
          {
            now,
            marketState: calendar.state(now),
            calendarValidUntil: calendar.validUntil,
            wrapPeriods: [],
            wrap: null,
            completedWrapKeys: new Set(),
            hidesPersonalValues: hides,
            isOffline: !online,
            discovery: null,
            weekAhead,
            calendar,
            watchlistInsights: ready.watchlist.filter(unexpired(now)),
          },
          {
            availability: availability!,
            watchlistCandidate: (insights) =>
              watchlistInsightCandidates(insights, {
                watchedIDs: watched,
                consumedKeys: ready.consumed,
                now,
                limit: 1,
                surface: "home",
                profile: personalisationSession.profile(new Set(), watched),
                exposure: personalisationSession.exposure,
              })[0] ?? null,
            receiptKeys: (insight) => [...receiptKeys(insight)],
          },
        )
      : null;

  const detail = open ? <InsightDetail insight={open} surface={discover.length ? "saturdayDiscover" : "home"} onClose={() => setOpen(null)} /> : null;
  const consume = (insight: Insight, surface: "home" | "saturdayDiscover") => void intelligence?.coordinator.consume(insight, surface);

  if (discover.length > 0) {
    return (
      <section aria-labelledby="home-discover" className="flex flex-col gap-3" data-testid="home-discover">
        <h2 id="home-discover" className="text-section text-primary-text">
          {t("home.saturday.header")}
        </h2>
        <ul className="flex flex-col rounded-large border-[length:var(--card-outline-width)] border-card-outline bg-card-background">
          {discover.map((selection, index) => {
            const { insight } = selection;
            const reason =
              selection.score.relationship === 80
                ? t("home.saturday.relatedPortfolio")
                : selection.score.relationship === 40
                  ? t("home.saturday.relatedWatchlist")
                  : t("common.marketInformation");
            const portfolio = insight.category === "portfolio";
            const tile = portfolio ? portfolioTiles([insight], insight.type === "portfolioAllocation" ? 1 : 0, hides, format, t)[0] : undefined;
            if (portfolio && !tile) return null;
            const item = portfolio ? null : watchlistPresentation(insight, symbols, format, t);
            const eyebrow = portfolio
              ? t("common.fromYourPortfolio")
              : insight.fact.kind === "watchlistInformation"
                ? t("home.saturday.publication", { arg1: insight.fact.value.sourceName })
                : insight.category === "watchlist"
                  ? t("home.saturday.fromWatchlist")
                  : t("common.market");
            const body = (
              <>
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-small bg-accent-soft text-accent">
                  <Icon name={portfolio ? "portfolio" : (item?.icon ?? "chart")} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-micro font-bold tracking-wide text-accent uppercase">{eyebrow}</span>
                  <span className="text-body font-semibold text-primary-text tabular-nums">{tile ? `${tile.title} · ${tile.value}` : item?.headline}</span>
                  <span className="text-caption text-secondary-text">{reason}</span>
                </span>
                <Icon name="chevron-right" className="text-tertiary-text" />
              </>
            );
            const row = "flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left";
            return (
              <li
                key={selection.id}
                className={index > 0 ? "border-t border-separator" : undefined}
                data-testid="home-discover-row"
                data-category={insight.category}
              >
                {portfolio ? (
                  <Link href="/carteira" className={row} onClick={() => consume(insight, "saturdayDiscover")}>
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={row}
                    onClick={() => {
                      setOpen(insight);
                      consume(insight, "saturdayDiscover");
                    }}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {detail}
      </section>
    );
  }

  const card = feature ? featureCard(feature, { t, symbols, format }) : null;
  if (!card) return detail ?? <>{fallback}</>;
  const watchlistInsight = feature?.content.kind === "watchlist" ? feature.content.insight : null;
  return (
    <>
      <Link
        href={card.href}
        onClick={watchlistInsight ? () => consume(watchlistInsight, "home") : undefined}
        className="flex min-h-18 items-center gap-4 rounded-large bg-elevated-background p-4"
        data-testid="home-context"
        data-kind={feature!.content.kind}
      >
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-accent text-accent">
          <Icon name={card.icon} scale="l" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-micro font-bold tracking-wide text-accent uppercase">{card.eyebrow}</span>
          <span className="text-body font-semibold text-primary-text">{card.headline}</span>
          <span className="text-caption text-secondary-text">{card.detail}</span>
        </span>
        <span className="flex items-center gap-1 text-secondary font-semibold text-accent max-sm:sr-only">
          {card.action}
          <Icon name="arrow-right" />
        </span>
      </Link>
      {detail}
    </>
  );
}

interface Card {
  readonly href: string;
  readonly icon: IconName;
  readonly eyebrow: string;
  readonly headline: string;
  readonly detail: string;
  readonly action: string;
}

function featureCard(
  feature: HomeContextFeature,
  { t, symbols, format }: { t: ReturnType<typeof useTranslate>; symbols: ReadonlyMap<string, string>; format: ReturnType<typeof useFormat> },
): Card | null {
  const content = feature.content;
  switch (content.kind) {
    case "watchlist": {
      const item = watchlistPresentation(content.insight, symbols, format, t);
      return {
        href: "/lista",
        icon: item.icon,
        eyebrow: t("home.saturday.fromWatchlist"),
        headline: item.headline,
        detail: item.context,
        action: t("intelligence.home.viewWatchlist"),
      };
    }
    case "weekAhead":
      return {
        href: "/semana",
        icon: "calendar",
        eyebrow: t("intelligence.nextWeek.eyebrow"),
        headline: content.headline,
        detail: content.detail,
        action: t("intelligence.nextWeek.action"),
      };
    case "discovery":
      return {
        href: "/inicio",
        icon: "chart",
        eyebrow: t("intelligence.discover.eyebrow"),
        headline: content.headline,
        detail: content.detail,
        action: t("intelligence.discover.action"),
      };
    // The Wrap cards arrive with the Wrap source.
    default:
      return null;
  }
}

/** Sunday's offer (iOS `WeekAheadHomeOfferProvider`): read only on a verified closed Sunday. */
function useWeekAheadOffer(now: number, calendar: MarketCalendar | undefined): HomeContextOffer | null {
  const t = useTranslate();
  const format = useFormat();
  const account = useAccount();
  const hides = usePrivacyMode();
  const userID = account?.userID ?? "";
  const sunday = isWeekAheadSunday(now, calendar);
  const store = useMemo(
    () => (userID && sunday ? new WeekAheadStore(async (signal) => decodeWeekAhead(await readAccountRoute("/api/account/week-ahead", userID, signal))) : null),
    [userID, sunday],
  );
  const state = useSyncExternalStore(
    (listener) => store?.subscribe(listener) ?? (() => {}),
    () => store?.getSnapshot() ?? null,
    () => null,
  );
  useEffect(() => {
    if (store) void store.load();
  }, [store]);

  const data = state?.data;
  const period = nextWeek(now);
  if (!data || !period || !calendar) return null;
  const usable = data.batch.isCached ? isReplayableBatch(data.batch, now) : isFreshBatch(data.batch, now);
  if (!usable) return null;
  const selection = selectWeek(
    data.batch,
    {
      now,
      period,
      heldIDs: data.heldIDs,
      watchedIDs: new Set(account?.watchlist ?? []),
      securities: data.securities,
      hidesPersonalValues: hides,
      closedDays: data.closedDays,
    },
    state.previous,
  );
  const offer = weekAheadOffer(selection, period, data.batch.fetchedAt, calendar, now);
  if (!offer) return null;
  const text = weekAheadText(t, format);
  return {
    kind: "weekAhead",
    headline: text.summary(selection),
    detail: t("intelligence.weekAhead.datesAnnounced", { arg1: text.period(period) }),
    destinationID: offer.destinationID,
    evidenceIDs: selection.ranked.map((item) => item.id),
    availableAt: data.batch.fetchedAt,
    expiresAt: offer.expiresAt,
    exposureKeys: selection.ranked.map((item) => `event:${semanticKey(item.event)}`),
    isConsumed: false,
  };
}
