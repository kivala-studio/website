"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import type { Translate } from "@/domain/format";
import { weekAheadText } from "@/domain/week-ahead/presentation";
import { type WeekItem, MILESTONE_TITLE_KEYS, dayInstant, isFreshBatch, isReplayableBatch, nextWeek, selectWeek } from "@/domain/week-ahead/week-ahead";
import { useAccount } from "@/features/account/account-provider";
import { readAccountRoute } from "@/features/account/results";
import { PrivacyModeButton, usePrivacyMode } from "@/features/privacy/privacy-mode";
import { Button } from "@/ui/components/buttons";
import { EmptyState, ErrorState, LoadingState } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { WeekAheadStore, decodeWeekAhead } from "./week-ahead-store";

/** The source refreshes every minute while the page is open (iOS `WeekAheadView`). */
const REFRESH_MS = 60_000;

/** Semana à frente: dates announced by a named source for the next civil week in Luanda. */
export function WeekAheadView({ renderedAt }: { renderedAt: number }) {
  const t = useTranslations();
  const translate: Translate = useCallback((key, values) => t(key as never, values as never), [t]);
  const format = useFormat();
  const text = useMemo(() => weekAheadText(translate, format), [translate, format]);
  const locale = useLocale();
  const account = useAccount();
  const userID = account?.userID ?? "";
  const watchlist = account?.watchlist;
  const hidesPersonalValues = usePrivacyMode();
  // One store per account: a change of account starts from nothing.
  const current = useMemo(() => new WeekAheadStore(async (signal) => decodeWeekAhead(await readAccountRoute("/api/account/week-ahead", userID, signal))), [userID]);
  const state = useSyncExternalStore(current.subscribe, current.getSnapshot, current.getSnapshot);
  const now = state.checkedAt ?? renderedAt;

  useEffect(() => {
    if (!userID) return;
    void current.load();
    const timer = window.setInterval(() => void current.load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [current, userID]);

  const period = useMemo(() => nextWeek(now), [now]);
  const loaded = state.data;
  const usable = loaded !== null && (loaded.batch.isCached ? isReplayableBatch(loaded.batch, now) : isFreshBatch(loaded.batch, now));
  const selection = useMemo(
    () =>
      loaded && period
        ? selectWeek(
            loaded.batch,
            {
              now,
              period,
              heldIDs: loaded.heldIDs,
              watchedIDs: new Set(watchlist ?? []),
              securities: loaded.securities,
              hidesPersonalValues,
              closedDays: loaded.closedDays,
            },
            state.previous,
          )
        : null,
    [loaded, period, now, watchlist, hidesPersonalValues, state.previous],
  );
  const weekday = useMemo(() => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "pt-AO", { weekday: "long", timeZone: "Africa/Luanda" }), [locale]);
  const dayTitle = (day: string) => {
    const name = weekday.format(dayInstant(day));
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} · ${format.civilDate(day)}`;
  };

  return (
    <div className="flex max-w-3xl flex-col gap-8" data-testid="week-ahead">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-display text-primary-text">{t("weekAhead.summary.title")}</h1>
          <PrivacyModeButton />
        </div>
        {period ? <p className="text-body text-secondary-text">{text.period(period)}</p> : null}
        {usable && selection && selection.ranked.length > 0 ? (
          <div className="flex flex-col gap-1" data-testid="week-ahead-summary">
            <p className="text-body text-primary-text">{text.summary(selection)}</p>
            {selection.portfolioCount > 0 && selection.watchlistCount > 0 ? (
              <p className="text-caption text-secondary-text">{text.watchlistLine(selection.watchlistCount)}</p>
            ) : null}
          </div>
        ) : null}
      </header>

      {usable && selection ? (
        <>
          {loaded.batch.isCached ? (
            <p className="text-caption text-secondary-text" data-testid="week-ahead-saved">
              {t("weekAhead.banner.cachedUpdated", { arg1: format.timestamp(loaded.batch.fetchedAt) })}
            </p>
          ) : null}
          {selection.ranked.length === 0 ? (
            <EmptyState icon="calendar" title={t("weekAhead.emptyState.title")} message={t("weekAhead.emptyState.message")} />
          ) : (
            <>
              {selection.days.map((day) => (
                <section key={day.id} aria-labelledby={`week-day-${day.id}`} className="flex flex-col gap-2" data-testid="week-ahead-day">
                  <h2 id={`week-day-${day.id}`} className="text-section text-primary-text">
                    {dayTitle(day.id)}
                  </h2>
                  {day.hasVerifiedClosure ? <p className="text-caption text-secondary-text">{t("weekAhead.list.noSession")}</p> : null}
                  <ul className="flex flex-col">
                    {day.items.map((item) => (
                      <EventRow key={item.id} item={item} text={text} />
                    ))}
                  </ul>
                </section>
              ))}
              <section aria-labelledby="week-about" className="flex flex-col gap-2 text-caption text-secondary-text">
                <h2 id="week-about" className="text-section text-primary-text">
                  {t("weekAhead.about.title")}
                </h2>
                <p>{t("weekAhead.about.announcedDates")}</p>
                <p>{t("weekAhead.about.portfolioLink")}</p>
                <p>{t("weekAhead.about.coverage")}</p>
              </section>
            </>
          )}
        </>
      ) : state.status === "loading" ? (
        <LoadingState message={t("weekAhead.state.checking")} />
      ) : (
        <ErrorState
          title={t("weekAhead.state.unavailableTitle")}
          message={t("weekAhead.state.unavailableMessage")}
          action={
            <Button kind="secondary" className="w-auto!" onClick={() => void current.load({ retry: true })}>
              {t("common.tryAgain")}
            </Button>
          }
        />
      )}
    </div>
  );
}

function EventRow({ item, text }: { item: WeekItem; text: ReturnType<typeof weekAheadText> }) {
  const t = useTranslations();
  const format = useFormat();
  const { event } = item;
  const dividend = event.metadata?.kind === "dividend" ? event.metadata : undefined;
  const title = dividend && event.issuer ? `${t(MILESTONE_TITLE_KEYS[dividend.milestone] as never)} · ${event.issuer.name}` : event.title;
  return (
    <li className="flex flex-col gap-1.5 border-b border-separator py-3 last:border-b-0" data-testid="week-ahead-event" data-relationship={item.relationship}>
      <p className="text-body font-semibold text-primary-text">{title}</p>
      <p className="text-caption text-secondary-text">{text.timing(event)}</p>
      <p className="flex items-center gap-1.5 text-caption text-secondary-text">
        <Icon name={event.status === "tentative" ? "history" : "calendar"} />
        {text.status(event.status)}
      </p>
      {item.relationship !== "market" ? <p className="text-caption font-semibold text-accent">{text.relationship(item.relationship)}</p> : null}
      {item.isDateCorrection ? (
        <p className="flex items-center gap-1.5 text-caption text-secondary-text">
          <Icon name="refresh" />
          {t("weekAhead.row.dateUpdated")}
        </p>
      ) : null}
      {dividend ? <p className="text-caption text-secondary-text">{t("weekAhead.row.financialYear", { arg1: String(dividend.fiscalYear) })}</p> : null}
      {event.sources.map((source) => (
        <div key={`${source.dataset}:${source.recordID}:${source.url}`} className="flex flex-col text-caption text-secondary-text">
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-fit items-center gap-1 text-accent">
            {t("common.sourceLabel", { arg1: source.name })}
            <Icon name="arrow-up-right" />
          </a>
          <span>{text.publication(source)}</span>
        </div>
      ))}
      <p className="text-micro text-tertiary-text">{t("weekAhead.row.recordUpdated", { arg1: format.timestamp(event.updatedAt) })}</p>
    </li>
  );
}
