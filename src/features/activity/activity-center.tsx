"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { type ActivityCategory, type ActivityFilter, type ActivityItem, activityDays, filterOf, isVisible } from "@/domain/activity/activity";
import { activityText } from "@/domain/activity/copy";
import { mergeActivityCentre } from "@/domain/intelligence/activity";
import type { Translate } from "@/domain/format";
import { DAY_MS, civilDate } from "@/domain/market/zone";
import { useAccountStores } from "@/features/account/account-provider";
import { useLocalActivity } from "@/features/intelligence/activity-rows";
import { PrivacyModeButton, usePrivacyMode } from "@/features/privacy/privacy-mode";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { Button, IconButton } from "@/ui/components/buttons";
import { SectionTabs } from "@/ui/components/controls";
import { Dialog } from "@/ui/components/dialog";
import { usePresence, usePresenceValue } from "@/ui/motion/use-presence";
import { Card, READING_COLUMN } from "@/ui/components/layout";
import { FlipList } from "@/ui/components/flip-list";
import { EmptyState, ErrorState, FadeIn, LoadingState } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon, type IconName } from "@/ui/icons/icon";

const FILTERS: readonly ActivityFilter[] = ["movements", "news"];

const CATEGORY: Record<ActivityCategory, { icon: IconName; tint: string; key: string | null }> = {
  news: { icon: "news", tint: "text-accent bg-accent/12", key: "common.news" },
  movements: { icon: "chart", tint: "text-comparison-orange bg-comparison-orange/12", key: "notifications.category.movements" },
  portfolio: { icon: "portfolio", tint: "text-comparison-purple bg-comparison-purple/12", key: "notifications.category.portfolio" },
  // Same word in both languages on iOS.
  watchlist: { icon: "watchlist", tint: "text-positive bg-positive/12", key: null },
};

const EMPTY: Record<ActivityFilter, { icon: IconName; title: string; message: string }> = {
  movements: { icon: "chart", title: "notifications.activity.noMovementsTitle", message: "notifications.activity.noMovementsMessage" },
  news: { icon: "news", title: "notifications.activity.noNewsTitle", message: "notifications.activity.noNewsMessage" },
};

/**
 * Atividade (iOS `ActivityCenterView`): Movimentos | Notícias, day sections newest first, one card per day with the
 * categories in a fixed order. Opening a row marks it read and goes to its destination; nothing is marked read by
 * opening the page. Rows render the server's composition; alerts never show their threshold.
 */
export function ActivityCenter({ symbols, renderedAt }: { symbols: Readonly<Record<string, string>>; renderedAt: number }) {
  const t = useTranslations();
  const translate: Translate = (key, values) => t(key as never, values as never);
  const format = useFormat();
  const privacyMode = usePrivacyMode();
  const router = useRouter();
  const store = useAccountStores()!.activity;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [filter, setFilter] = useState<ActivityFilter>("movements");
  const [unavailable, setUnavailable] = useState(false);
  const notice = usePresenceValue(unavailable);
  const now = state.loadedAt ?? renderedAt;
  const local = useLocalActivity(now);
  const items = useMemo(
    () => (state.status === "loaded" ? mergeActivityCentre(state.items, local.rows) : state.items),
    [state.status, state.items, local.rows],
  );
  /** Server rows send receipts; the weekly reading's rows are read on this device. */
  const markRead = (ids: readonly string[], opened = false) => {
    local.markRead(local.rows.filter((row) => ids.includes(row.id)));
    return store.markRead(ids, opened);
  };

  useEffect(() => {
    void store.load({ quiet: store.getSnapshot().status === "loaded" });
  }, [store]);

  const days = useMemo(() => activityDays(items, filter, now), [items, filter, now]);
  const unread = items.some((item) => !item.read && filterOf(item.category) === filter && isVisible(item, now));
  const anything = items.some((item) => isVisible(item, now));

  const href = (item: ActivityItem): string | null | undefined => {
    const { destination } = item;
    switch (destination.kind) {
      case "instrument": {
        const symbol = symbols[destination.securityID];
        return symbol ? `/mercado/${encodeURIComponent(symbol)}` : null;
      }
      case "article":
        return destination.slug ? `/noticias/${destination.slug}` : null;
      case "wrap":
        return `/wrap/${destination.period}`;
      case "portfolio":
        return "/carteira";
      case "watchlist":
        return "/lista";
      case "unusualDigest":
        return "/atividade-invulgar";
      case "none":
        return undefined;
    }
  };

  const dayTitle = (date: string) => {
    if (date === civilDate(now)) return t("common.today");
    if (date === civilDate(now - DAY_MS)) return t("common.yesterday");
    return format.dayMonth(date, now);
  };

  const filterIndex = FILTERS.indexOf(filter);

  return (
    <div className={cn(READING_COLUMN, "gap-4")}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Grows from its own width, so on a narrow phone the actions wrap under the title instead of covering it. */}
        <h1 className="min-w-0 grow text-display text-primary-text">{t("common.activity")}</h1>
        <div className="flex items-center gap-2">
          <PrivacyModeButton />
          <IconButton icon="refresh" label={t("common.refresh")} onClick={() => void store.load()} />
          <Button
            kind="secondary"
            className="w-auto!"
            disabled={!unread}
            onClick={() => {
              local.markRead(local.rows.filter((row) => !row.read && filterOf(row.category) === filter && isVisible(row, now)));
              void store.markAllRead(filter);
            }}
            data-testid="mark-all-read"
          >
            {t("notifications.button.markAllRead")}
          </Button>
        </div>
      </div>

      <SectionTabs
        label={t("notifications.filter.accessibility")}
        titles={[t("notifications.filter.movements"), t("common.news")]}
        selected={filterIndex}
        onSelect={(index) => setFilter(FILTERS[index])}
        idPrefix="activity"
      />

      {state.stale && state.loadedAt !== null ? (
        <p role="status" className="text-caption text-secondary-text">
          {t("notifications.activity.savedHistory", { arg1: format.timestamp(state.loadedAt) })}
        </p>
      ) : null}
      {state.receiptsPending ? (
        <button
          type="button"
          onClick={() => void store.retryReceipts()}
          className="inline-flex min-h-11 items-center self-start text-left text-caption text-accent"
          data-testid="receipts-pending"
        >
          {t("notifications.activity.updatesPending")}
        </button>
      ) : null}

      <section role="tabpanel" id={`activity-panel-${filterIndex}`} aria-labelledby={`activity-tab-${filterIndex}`} className="flex flex-col gap-4">
        {state.status === "loading" || state.status === "idle" ? (
          <LoadingState message={t("notifications.activity.loading")} />
        ) : state.status === "failed" ? (
          <ErrorState
            message={t("components.placeholder.loadFailed")}
            action={
              <Button kind="secondary" className="w-auto!" onClick={() => void store.load()}>
                {t("common.tryAgain")}
              </Button>
            }
          />
        ) : !anything ? (
          <EmptyState icon="check" title={t("notifications.activity.upToDateTitle")} message={t("notifications.activity.upToDateMessage")} />
        ) : days.length === 0 ? (
          <EmptyState icon={EMPTY[filter].icon} title={t(EMPTY[filter].title as never)} message={t(EMPTY[filter].message as never)} />
        ) : (
          // Another filter or page: a day that arrives fades in, rows that stay glide, new ones fade in.
          days.map((day) => (
            <FadeIn key={day.date}>
              <Card title={dayTitle(day.date)} titleId={`day-${day.date}`} bodyClassName="flex flex-col gap-4 pb-2!">
                <div className="flex flex-col gap-4">
                  {day.groups.map((group) => (
                    <div key={group.category} className="flex flex-col">
                      <span
                        className={cn(
                          "inline-flex min-h-7 items-center gap-1.5 self-start rounded-full px-2.5 text-caption font-semibold",
                          CATEGORY[group.category].tint,
                        )}
                      >
                        <Icon name={CATEGORY[group.category].icon} scale="s" />
                        <span className="text-primary-text">{CATEGORY[group.category].key ? t(CATEGORY[group.category].key as never) : "Watchlist"}</span>
                      </span>
                      <FlipList className="flex flex-col divide-y divide-hairline">
                        {group.items.map((item) => (
                          <ActivityRow
                            key={item.id}
                            item={item}
                            href={href(item)}
                            text={activityText(item, { t: translate, format, symbolOf: (id) => symbols[id], privacyMode })}
                            time={format.time(item.occurredAt)}
                            stateLabel={t(item.read ? "common.read" : "common.unread")}
                            markLabel={t("common.markAsRead")}
                            onOpen={() => void markRead([item.id], true)}
                            onUnavailable={() => {
                              void markRead([item.id], true);
                              setUnavailable(true);
                            }}
                            onMark={() => void markRead([item.id])}
                          />
                        ))}
                      </FlipList>
                    </div>
                  ))}
                </div>
              </Card>
            </FadeIn>
          ))
        )}
        {state.status === "loaded" && state.cursor ? (
          <Button kind="secondary" className="self-center sm:w-auto" loading={state.loadingMore} onClick={() => void store.loadMore()} data-testid="load-more">
            {t("common.loadMore")}
          </Button>
        ) : null}
      </section>

      {notice.value ? (
        <Dialog
          key={notice.key}
          variant="dialog"
          open={notice.open}
          onClose={() => setUnavailable(false)}
          title={t("common.informationUnavailable")}
          footer={
            <Button
              kind="secondary"
              className="w-full"
              onClick={() => {
                setUnavailable(false);
                router.refresh();
              }}
            >
              {t("common.refresh")}
            </Button>
          }
        >
          <p className="text-body text-primary-text">{t("notifications.activity.destinationUnavailable")}</p>
        </Dialog>
      ) : null}
    </div>
  );
}

function ActivityRow({
  item,
  href,
  text,
  time,
  stateLabel,
  markLabel,
  onOpen,
  onUnavailable,
  onMark,
}: {
  item: ActivityItem;
  /** A destination; null when it is no longer in the catalogue; undefined when the row opens nothing. */
  href: string | null | undefined;
  text: { title: string; body: string; accessibilityText: string };
  time: string;
  stateLabel: string;
  markLabel: string;
  onOpen: () => void;
  onUnavailable: () => void;
  onMark: () => void;
}) {
  // Marked read: the button shrinks away before the row closes up.
  const mark = usePresence(!item.read);
  // Screen readers get the server's accessibility text; the visible lines repeat it.
  const content = (
    <>
      <span aria-hidden className={cn("text-body text-primary-text", item.read ? "font-normal" : "font-semibold")}>
        {text.title}
      </span>
      {text.body ? (
        <span aria-hidden className="text-secondary text-secondary-text">
          {text.body}
        </span>
      ) : null}
      <span aria-hidden className="text-caption text-secondary-text">
        {time}
      </span>
      <span className="sr-only">{`${text.accessibilityText}, ${time}, ${stateLabel}`}</span>
    </>
  );
  const body = "flex min-h-11 min-w-0 flex-1 flex-col items-start gap-1 rounded-small py-4 text-left";
  return (
    <li data-testid="activity-row" data-read={item.read} data-flip-key={item.id} className="flex items-center gap-2">
      {href ? (
        <Link href={href} prefetch={false} onClick={onOpen} className={body}>
          {content}
        </Link>
      ) : href === null ? (
        <button type="button" onClick={onUnavailable} className={body}>
          {content}
        </button>
      ) : (
        <div className={body}>{content}</div>
      )}
      {mark.mounted ? (
        <span {...mark.presenceProps} className="motion-pop inline-flex">
          <IconButton icon="check" label={markLabel} onClick={onMark} className="bg-transparent text-secondary-text" data-testid="mark-read" />
        </span>
      ) : null}
    </li>
  );
}
