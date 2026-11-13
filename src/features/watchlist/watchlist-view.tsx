"use client";

import { useTranslations } from "next-intl";
import { type DragEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { pausedIDs } from "@/domain/account/watchlist";
import { moved } from "@/domain/account/watchlist-ordering";
import { type MarketSecurity, displayPrice, isBondKind, securityDisplayName } from "@/domain/market";
import { useAccount, useAccountStores } from "@/features/account/account-provider";
import { AlertsDialog, type AlertTarget } from "@/features/alerts/alerts-dialog";
import { ACCOUNT_STORAGE_PREFIX } from "@/features/auth/account-state";
import { type CatalogueRow, PriceCell } from "@/features/market/browse/price-cell";
import { useMarketState, useMarketStore } from "@/features/market/market-provider";
import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { Button, IconButton } from "@/ui/components/buttons";
import { SectionTabs } from "@/ui/components/controls";
import { Menu, type MenuEntry } from "@/ui/components/menu";
import { SecurityLogo } from "@/ui/components/rows";
import { EmptyState, InstrumentRowSkeleton, SectionPlaceholder } from "@/ui/components/states";
import { WatchlistInsights } from "@/features/intelligence/watchlist-insights";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { AddDialog } from "./add-dialog";
import { FreeSelectionDialog } from "./free-selection-dialog";
import { GroupNameDialog } from "./group-name-dialog";

type Naming = { mode: "new"; member?: string } | { mode: "rename"; id: string; name: string };

const groupListeners = new Set<() => void>();
const subscribeGroup = (listener: () => void) => {
  groupListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    groupListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
};

/** The selected group tab, per account, in this browser. */
function useSelectedGroup(userID: string, groups: readonly { id: string }[]) {
  const key = `${ACCOUNT_STORAGE_PREFIX}${userID}.watchlistGroup`;
  const read = () => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const selected = useSyncExternalStore(subscribeGroup, read, () => null);
  const select = (id: string | null) => {
    try {
      if (id) window.localStorage.setItem(key, id);
      else window.localStorage.removeItem(key);
    } catch {
      // Not remembered: storage is unavailable.
    }
    for (const listener of groupListeners) listener();
  };
  return [groups.some((group) => group.id === selected) ? selected : null, select] as const;
}

/**
 * `/lista` (iOS `WatchlistView`): the account's instruments in saved order with live prices, alerts per row, a
 * row menu in place of swipes, Plus groups, the Free plan selection and remove with undo. Reordering drags on
 * `Todos`, or moves one step from the row menu without a pointer.
 */
export function WatchlistView({ rows, renderedAt }: { rows: readonly CatalogueRow[]; renderedAt: number }) {
  const t = useTranslations();
  const format = useFormat();
  const stores = useAccountStores()!;
  const account = useAccount()!;
  const market = useMarketState();
  const marketStore = useMarketStore();
  const list = useSyncExternalStore(stores.watchlist.subscribe, stores.watchlist.getSnapshot, stores.watchlist.getSnapshot);
  const alerts = useSyncExternalStore(stores.alerts.subscribe, stores.alerts.getSnapshot, stores.alerts.getSnapshot);
  const [groupID, selectGroup] = useSelectedGroup(account.userID, list.groups);
  const [adding, setAdding] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [naming, setNaming] = useState<Naming | null>(null);
  const [alerting, setAlerting] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  useEffect(() => {
    void stores.watchlist.load(true);
    const controller = new AbortController();
    void stores.alerts.load(controller.signal);
    return () => controller.abort();
  }, [stores]);

  const snapshot = market.load.kind === "loaded" ? market.load.snapshot : undefined;
  const at = market.assessedAt;
  const securities = useMemo(() => new Map((snapshot?.securities ?? []).map((security) => [security.id, security])), [snapshot]);
  const byID = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const group = list.groups.find((item) => item.id === groupID);
  const visible = group ? list.order.filter((id) => group.members.includes(id)) : list.order;
  const paused = pausedIDs(list.order, account.access);
  const freePlan = account.access?.enforcementEnabled === true && !account.access.isPlus;
  const activeAlerts = alerts.rules.filter((rule) => rule.isEnabled && list.order.includes(rule.securityID));
  const symbol = (id: string) => byID.get(id)?.symbol ?? securities.get(id)?.symbol ?? "";

  const newGroup = (member?: string) => {
    if (account.access?.enforcementEnabled && !account.unlocksPlus) return account.requestUpgrade("watchlistGroups");
    setNaming({ mode: "new", member });
  };

  const remove = (id: string) => {
    const handle = stores.watchlist.removeForUndo(id);
    if (handle) requestAnimationFrame(() => document.getElementById("watchlist-undo")?.focus());
  };

  const drop = (target: string) => {
    if (!dragging || dragging === target) return;
    const order = list.order.filter((id) => id !== dragging);
    const from = list.order.indexOf(dragging);
    const to = list.order.indexOf(target);
    order.splice(order.indexOf(target) + (from < to ? 1 : 0), 0, dragging);
    stores.watchlist.setOrder(order);
  };

  const rowMenu = (id: string, index: number): MenuEntry[] => {
    const entries: MenuEntry[] = [
      {
        kind: "item",
        label: t("common.alerts"),
        icon: "notification",
        onSelect: () => setAlerting(id),
      },
      {
        kind: "check",
        label: t("common.automaticMovements"),
        checked: list.automatic.get(id) ?? false,
        onToggle: () => stores.watchlist.setAutomatic(id, !(list.automatic.get(id) ?? false)),
      },
      { kind: "heading", label: t("watchlist.groups.title") },
      ...list.groups.map((item): MenuEntry => ({
        kind: "check",
        label: item.name,
        checked: item.members.includes(id),
        onToggle: () => stores.watchlist.setGroupMember(item.id, id, !item.members.includes(id)),
      })),
      {
        kind: "item",
        label: t("watchlist.groups.new"),
        icon: "add",
        onSelect: () => newGroup(id),
      },
      { kind: "separator" },
    ];
    if (!group) {
      entries.push(
        {
          kind: "item",
          label: t("site.watchlist.moveUp"),
          icon: "arrow-up",
          disabled: index === 0,
          onSelect: () => stores.watchlist.setOrder(moved(list.order, id, -1)),
          testID: "move-up",
        },
        {
          kind: "item",
          label: t("site.watchlist.moveDown"),
          icon: "arrow-down",
          disabled: index === list.order.length - 1,
          onSelect: () => stores.watchlist.setOrder(moved(list.order, id, 1)),
          testID: "move-down",
        },
        { kind: "separator" },
      );
    }
    entries.push({
      kind: "item",
      label: t("watchlist.row.removeAction"),
      icon: "trash",
      destructive: true,
      onSelect: () => remove(id),
      testID: "remove",
    });
    return entries;
  };

  const alertTarget = (id: string): AlertTarget => {
    const security = securities.get(id);
    const row = byID.get(id);
    return {
      id,
      symbol: symbol(id),
      bond: row?.bond ?? (security ? isBondKind(security.kind) : false),
      currency: row?.currency ?? security?.currency ?? "AOA",
      price: security && at !== undefined ? displayPrice(security, at) : undefined,
    };
  };

  const loaded = list.status === "loaded";
  const undone = list.undo;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-display text-primary-text">{t("common.yourWatchlist")}</h1>
          {loaded ? (
            <p className="text-secondary text-secondary-text" data-testid="watchlist-count">
              {t("common.watchedInstrumentsCount", {
                arg1: format.count(list.order.length),
              })}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <IconButton icon="refresh" label={t("common.refresh")} onClick={() => (void stores.watchlist.load(true), void marketStore.load({ force: true }))} />
          {loaded && list.order.length > 0 ? (
            <Menu
              label={t("watchlist.groups.title")}
              testID="groups-menu"
              trigger={<span>{t("watchlist.groups.title")}</span>}
              entries={[
                {
                  kind: "item",
                  label: t("watchlist.groups.new"),
                  icon: "add",
                  onSelect: () => newGroup(),
                },
                ...list.groups.flatMap((item): MenuEntry[] => [
                  { kind: "heading", label: item.name },
                  {
                    kind: "item",
                    label: t("watchlist.groups.rename"),
                    icon: "edit",
                    onSelect: () =>
                      setNaming({
                        mode: "rename",
                        id: item.id,
                        name: item.name,
                      }),
                  },
                  {
                    kind: "item",
                    label: t("common.delete"),
                    icon: "trash",
                    destructive: true,
                    onSelect: () => stores.watchlist.deleteGroup(item.id),
                  },
                ]),
              ]}
            />
          ) : null}
        </div>
        <Button icon="add" className="sm:w-auto" onClick={() => setAdding(true)} data-testid="add-instruments">
          {t("common.addInstruments")}
        </Button>
      </div>

      {loaded && list.groups.length > 0 && list.order.length > 0 ? (
        <SectionTabs
          label={t("watchlist.groups.title")}
          titles={[t("watchlist.groups.all"), ...list.groups.map((item) => item.name)]}
          selected={group ? list.groups.indexOf(group) + 1 : 0}
          onSelect={(index) => selectGroup(index === 0 ? null : list.groups[index - 1].id)}
        />
      ) : null}

      {loaded && (freePlan || activeAlerts.length > 0) ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {freePlan ? (
            <button
              type="button"
              onClick={() => setChoosing(true)}
              className="inline-flex min-h-11 items-center gap-2 text-secondary text-accent"
              data-testid="free-plan-line"
            >
              <Icon name="filter" />
              {t("watchlist.freePlan.summary", {
                arg1: format.count(account.access!.activeWatchlistIDs.length),
                arg2: format.count(paused.size),
              })}
            </button>
          ) : null}
          {activeAlerts.length > 0 ? (
            <span className="inline-flex min-h-11 items-center gap-2 text-secondary text-secondary-text">
              <Icon name="alert" className="text-accent" />
              {t("common.activeAlertsCount", {
                arg1: format.count(activeAlerts.length),
              })}
            </span>
          ) : null}
        </div>
      ) : null}

      {undone ? (
        <div role="status" className="flex items-center gap-2 rounded-medium bg-elevated-background py-1 pr-1 pl-4" data-testid="undo-bar">
          <span className="flex-1 text-body text-primary-text">{t("watchlist.undo.removed", { arg1: symbol(undone.securityID) })}</span>
          <button
            id="watchlist-undo"
            type="button"
            onClick={() => stores.watchlist.undo(undone)}
            className="min-h-11 rounded-full px-3 text-body font-semibold text-accent"
          >
            {t("watchlist.undo.button")}
          </button>
          <IconButton icon="close" label={t("common.close")} onClick={() => stores.watchlist.discardUndo(undone)} />
        </div>
      ) : null}

      <section aria-label={group?.name ?? t("common.yourWatchlist")} className="lg:panel lg:px-4" data-testid="watchlist">
        {list.status === "failed" ? (
          <div className="py-4">
            <SectionPlaceholder title={t("common.watchlist")} failed onRetry={() => void stores.watchlist.load(true)} />
          </div>
        ) : !loaded ? (
          <div role="status" aria-label={t("watchlist.accessibility.loading")}>
            {Array.from({ length: 6 }, (_, index) => (
              <InstrumentRowSkeleton key={index} />
            ))}
          </div>
        ) : list.order.length === 0 ? (
          <div className="py-10">
            <EmptyState
              icon="watchlist"
              title={t("watchlist.emptyState.title")}
              message={t("watchlist.emptyState.message")}
              action={
                <Button icon="add" className="w-auto" onClick={() => setAdding(true)}>
                  {t("common.addInstruments")}
                </Button>
              }
            />
          </div>
        ) : visible.length === 0 ? (
          <div className="py-10">
            <EmptyState icon="filter" title={group!.name} />
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {visible.map((id) => {
              const security = securities.get(id);
              const row = byID.get(id);
              const count = alerts.rules.filter((rule) => rule.securityID === id && rule.isEnabled).length;
              const drag = !group
                ? {
                    draggable: true,
                    onDragStart: (event: DragEvent) => {
                      event.dataTransfer.effectAllowed = "move";
                      setDragging(id);
                    },
                    onDragOver: (event: DragEvent) => {
                      if (!dragging) return;
                      event.preventDefault();
                      setOver(id);
                    },
                    onDrop: (event: DragEvent) => {
                      event.preventDefault();
                      drop(id);
                      setDragging(null);
                      setOver(null);
                    },
                    onDragEnd: () => {
                      setDragging(null);
                      setOver(null);
                    },
                  }
                : {};
              return (
                <li
                  key={id}
                  {...drag}
                  data-testid="watchlist-row"
                  className={cn("flex items-center gap-1", dragging === id && "opacity-50", over === id && dragging !== id && "bg-accent-soft")}
                >
                  {!group ? (
                    <span aria-hidden className="hidden shrink-0 cursor-grab text-tertiary-text desk:block">
                      <Icon name="sort" />
                    </span>
                  ) : null}
                  <WatchlistRow id={id} security={security} row={row} at={at} paused={paused.has(id)} />
                  <IconButton
                    icon={count > 0 ? "alert" : "notification"}
                    label={
                      count > 0
                        ? t("watchlist.accessibility.manageAlerts", {
                            arg1: format.count(count),
                            arg2: symbol(id),
                          })
                        : t("watchlist.accessibility.createAlert", {
                            arg1: symbol(id),
                          })
                    }
                    onClick={() => setAlerting(id)}
                    className={cn("relative max-sm:hidden", count > 0 ? "text-accent" : "text-secondary-text")}
                  />
                  <Menu label={t("site.watchlist.options", { arg1: symbol(id) })} entries={rowMenu(id, list.order.indexOf(id))} testID="row-menu" />
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {loaded && list.order.length > 0 && !group ? <WatchlistInsights /> : null}

      <AddDialog open={adding} onClose={() => setAdding(false)} rows={rows} renderedAt={renderedAt} />
      {choosing && account.access ? <FreeSelectionDialog onClose={() => setChoosing(false)} rows={byID} /> : null}
      {naming ? (
        <GroupNameDialog
          naming={naming}
          onClose={() => setNaming(null)}
          onSave={(name) => {
            if (!naming) return;
            if (naming.mode === "rename") stores.watchlist.renameGroup(naming.id, name);
            else {
              const id = stores.watchlist.createGroup(name, naming.member);
              if (id && !naming.member) selectGroup(id);
            }
            setNaming(null);
          }}
        />
      ) : null}
      {alerting ? <AlertsDialog open onClose={() => setAlerting(null)} target={alertTarget(alerting)} /> : null}
    </div>
  );
}

function WatchlistRow({ id, security, row, at, paused }: { id: string; security?: MarketSecurity; row?: CatalogueRow; at?: number; paused: boolean }) {
  const t = useTranslations();
  const symbol = row?.symbol ?? security?.symbol ?? "";
  const name = (security ? securityDisplayName(security) : null) ?? row?.name ?? "";
  return (
    <Link
      href={`/mercado/${encodeURIComponent(symbol)}`}
      prefetch={false}
      className="flex min-h-20 min-w-0 flex-1 items-center gap-3 rounded-small py-3 desk:min-h-16 desk:py-2"
      data-security={id}
    >
      <SecurityLogo symbol={symbol} logoUrl={row?.logoURL ?? security?.logoURL} brandColor={row?.bond ? "violet" : "blue"} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-body font-semibold text-primary-text">{symbol}</span>
        <span className="flex min-w-0 items-center gap-2">
          {paused ? (
            <span className="shrink-0 rounded-full bg-elevated-background px-2 py-0.5 text-caption text-secondary-text" data-testid="paused-badge">
              {t("subscriptions.freeSelection.paused")}
            </span>
          ) : null}
          <span className="truncate text-secondary text-secondary-text">{name}</span>
        </span>
      </span>
      <PriceCell row={row} security={security} at={at} className="shrink-0" />
    </Link>
  );
}
