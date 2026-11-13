"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { Translate } from "@/domain/format";
import { type MarketSecurity, securityDisplayName } from "@/domain/market";
import { unusualSentence, unusualSignal } from "@/domain/unusual-activity/copy";
import { type UnusualEvent, type UnusualGroup, unusualGroups } from "@/domain/unusual-activity/unusual-activity";
import { useAccount, useAccountStores } from "@/features/account/account-provider";
import { UnusualActivitySwitches } from "@/features/activity/notification-settings";
import { type CatalogueRow, PriceCell } from "@/features/market/browse/price-cell";
import { useMarketState } from "@/features/market/market-provider";
import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { Button, IconButton } from "@/ui/components/buttons";
import { Dialog } from "@/ui/components/dialog";
import { SecurityLogo } from "@/ui/components/rows";
import { EmptyState, ErrorState, LoadingState, SectionPlaceholder } from "@/ui/components/states";
import { useFormat } from "@/ui/format";

import { UnusualActivityStore } from "./unusual-activity-store";

function useUnusualActivity() {
  const [store] = useState(() => new UnusualActivityStore());
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    void store.load();
    return () => store.cancel();
  }, [store]);
  return { state, refresh: () => void store.load() };
}

/**
 * `/atividade-invulgar` (iOS `UnusualActivityView`): the latest session's signals per instrument, followed
 * instruments first and shares before bonds, each with its signal lines and the market-information disclaimer.
 */
export function UnusualActivityView({ rows }: { rows: readonly CatalogueRow[] }) {
  const t = useTranslations();
  const format = useFormat();
  const translate: Translate = (key, values) => t(key as never, values as never);
  const tools = { t: translate, format };
  const account = useAccount();
  const market = useMarketState();
  const { state: load, refresh } = useUnusualActivity();
  const { refreshing } = load;
  const [settings, setSettings] = useState(false);

  const snapshot = market.load.kind === "loaded" ? market.load.snapshot : undefined;
  const securities = useMemo(() => new Map((snapshot?.securities ?? []).map((security) => [security.id, security])), [snapshot]);
  const byID = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const watched = account?.watchlist;
  const groups = useMemo(() => (load.status === "loaded" ? unusualGroups(load.events, new Set(watched ?? [])) : []), [load.status, load.events, watched]);
  const followed = groups.filter((group) => group.isFollowed);
  const others = groups.filter((group) => !group.isFollowed);
  const sessionDate = load.status === "loaded" ? load.events[0]?.tradingDate : undefined;

  const section = (title: string | null, list: readonly UnusualGroup[], id: string) =>
    list.length === 0 ? null : (
      <section aria-labelledby={title ? id : undefined} className="flex flex-col">
        {title ? (
          <h2 id={id} className="pt-2 pb-1 text-secondary font-semibold text-secondary-text">
            {title}
          </h2>
        ) : null}
        <ul className="flex flex-col divide-y divide-hairline">
          {list.map((group) => (
            <GroupRow
              key={group.securityID}
              group={group}
              row={byID.get(group.securityID)}
              security={securities.get(group.securityID)}
              at={market.assessedAt}
              line={(event) => ({ signal: unusualSignal(event, tools), sentence: unusualSentence(event, tools) })}
            />
          ))}
        </ul>
      </section>
    );

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 basis-full flex-col gap-1 sm:basis-0">
          <h1 className="text-display text-primary-text">{t("unusualActivity.title")}</h1>
          {sessionDate ? <p className="text-secondary text-secondary-text">{format.civilDate(sessionDate)}</p> : null}
        </div>
        <div className="order-first ml-auto flex items-center gap-2 sm:order-none">
          <IconButton icon="refresh" label={t("common.refresh")} disabled={refreshing} onClick={refresh} data-testid="unusual-refresh" />
          {account ? <IconButton icon="notification" label={t("unusualActivity.settings.notifications")} onClick={() => setSettings(true)} data-testid="unusual-settings" /> : null}
        </div>
      </div>

      {load.status === "loading" ? (
        <LoadingState message={t("common.loading")} />
      ) : load.status === "failed" ? (
        <ErrorState
          message={t("components.placeholder.loadFailed")}
          action={
            <Button kind="secondary" className="w-auto" loading={refreshing} onClick={refresh}>
              {t("common.tryAgain")}
            </Button>
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState icon="chart" title={t("unusualActivity.empty")} message={t("unusualActivity.disclaimer")} />
      ) : (
        <div className="flex flex-col gap-2 rounded-large bg-card-background px-4 py-2 lg:panel" data-testid="unusual-activity">
          {followed.length > 0 ? (
            <>
              {section(t("common.watchlist"), followed, "unusual-followed")}
              {section(t("common.market"), others, "unusual-market")}
            </>
          ) : (
            section(null, others, "unusual-market")
          )}
        </div>
      )}
      {load.status === "loaded" && groups.length > 0 ? <p className="text-caption text-tertiary-text">{t("unusualActivity.disclaimer")}</p> : null}

      {settings ? <NotificationSheet onClose={() => setSettings(false)} /> : null}
    </div>
  );
}

function GroupRow({
  group,
  row,
  security,
  at,
  line,
}: {
  group: UnusualGroup;
  row?: CatalogueRow;
  security?: MarketSecurity;
  at?: number;
  line: (event: UnusualEvent) => { signal: ReturnType<typeof unusualSignal>; sentence: string };
}) {
  const t = useTranslations();
  const format = useFormat();
  const known = row !== undefined || security !== undefined;
  const name = (security ? securityDisplayName(security) : undefined) ?? row?.name ?? group.name;
  const identity = (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="truncate text-body font-semibold text-primary-text">{group.symbol}</span>
      {name !== group.symbol ? <span className="truncate text-secondary text-secondary-text">{name}</span> : null}
    </span>
  );
  return (
    <li className="flex flex-col pb-4" data-testid="unusual-group" data-security={group.securityID}>
      {known ? (
        <Link href={`/mercado/${encodeURIComponent(group.symbol)}`} prefetch={false} className="flex min-h-16 min-w-0 items-center gap-3 rounded-small py-3 desk:py-2">
          <SecurityLogo symbol={group.symbol} logoUrl={row?.logoURL ?? security?.logoURL} brandColor={row?.bond ? "violet" : "blue"} />
          {identity}
          <PriceCell row={row} security={security} at={at} className="shrink-0" />
        </Link>
      ) : (
        <div className="flex min-h-11 items-center py-3">{identity}</div>
      )}
      <ul className={cn("flex flex-col gap-2", known && "sm:pl-15 desk:pl-12")}>
        {group.events.map((event) => {
          const { signal, sentence } = line(event);
          const tone = event.isWithdrawn
            ? "text-secondary-text"
            : signal.direction === "up"
              ? "text-positive"
              : signal.direction === "down"
                ? "text-negative"
                : "text-primary-text";
          const side = event.isWithdrawn ? t("unusualActivity.withdrawn") : signal.time !== undefined ? format.time(signal.time) : null;
          return (
            <li key={event.id} className="flex items-baseline gap-2 text-secondary" data-testid="unusual-signal" data-rule={event.rule} data-withdrawn={event.isWithdrawn}>
              <span className="sr-only">{side ? `${sentence} ${side}` : sentence}</span>
              <span aria-hidden className={cn("min-w-0 flex-1", event.isWithdrawn && "line-through")}>
                <span className={cn("font-semibold tabular-nums", tone)}>{signal.value}</span> <span className="text-secondary-text">{signal.label}</span>
              </span>
              {side ? (
                <span aria-hidden className="shrink-0 text-caption text-secondary-text tabular-nums">
                  {side}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

/** The bell: the same switches as Settings → Notificações. */
function NotificationSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const store = useAccountStores()!.preferences;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => {
    const controller = new AbortController();
    void store.load(controller.signal);
    return () => controller.abort();
  }, [store]);

  return (
    <Dialog open onClose={onClose} title={t("unusualActivity.title")}>
      <div className="flex flex-col" data-testid="unusual-notification-settings">
        {state.preferences ? (
          <UnusualActivitySwitches preferences={state.preferences.unusual} store={store} />
        ) : (
          <SectionPlaceholder title={t("unusualActivity.settings.notifications")} failed={state.status === "failed"} onRetry={() => void store.load()} />
        )}
      </div>
    </Dialog>
  );
}
