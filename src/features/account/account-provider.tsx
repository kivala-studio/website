"use client";

import { useTranslations } from "next-intl";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { type SubscriptionAccess, unlocks } from "@/domain/account/access";
import { decodeAccessJSON } from "@/domain/account/watchlist";
import { UPGRADE_REASON_KEYS, type UpgradeReason } from "@/domain/errors";
import { upgradeTier } from "@/domain/errors/rules";
import { ACTIVITY_REFRESH_MS, ActivityStore } from "@/features/activity/activity-store";
import { PreferencesStore } from "@/features/activity/preferences-store";
import { accountActivityRepository, accountPreferencesRepository } from "@/features/activity/repository";
import { AlertsStore } from "@/features/alerts/alerts-store";
import { accountAlertRepository } from "@/features/alerts/repository";
import { appErrors } from "@/features/errors/error-presenter";
import { PortfolioStore } from "@/features/portfolio/portfolio-store";
import { accountPortfolioRepository } from "@/features/portfolio/repository";
import { accountWatchlistRepository } from "@/features/watchlist/repository";
import { WatchlistStore } from "@/features/watchlist/watchlist-store";
import { Button } from "@/ui/components/buttons";
import { Dialog } from "@/ui/components/dialog";
import { useToast } from "@/ui/components/feedback";

import { readAccountRoute } from "./results";

export type AccountInitial = {
  readonly userID: string;
  readonly watchlist: readonly string[];
  /** Null when it could not be read: nothing is locked then (the server still enforces). */
  readonly access: SubscriptionAccess | null;
  /** The bell's dot as the server saw it for this page. */
  readonly hasUnread: boolean;
};

/** The plan access of this tab's account; re-read after confirmed watchlist changes. */
class AccessStore {
  private access: SubscriptionAccess | null;
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly userID: string,
    initial: SubscriptionAccess | null,
  ) {
    this.access = initial;
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.access;

  apply(access: SubscriptionAccess | null) {
    if (!access) return;
    this.access = access;
    for (const listener of this.listeners) listener();
  }

  /** Coalesces a burst of confirmed changes into one read; a failure keeps what is shown. */
  refreshSoon() {
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      const body = await readAccountRoute("/api/account/access", this.userID).catch(() => null);
      this.apply(body ? decodeAccessJSON(body.access) : null);
    }, 400);
  }
}

type AccountContextValue = {
  userID: string;
  access: AccessStore;
  watchlist: WatchlistStore;
  alerts: AlertsStore;
  activity: ActivityStore;
  preferences: PreferencesStore;
  portfolio: PortfolioStore;
  /** Opens the neutral plan dialog with the reason sentence (the plans page arrives in W16). */
  requestUpgrade: (reason: UpgradeReason) => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);

const EMPTY_SUBSCRIBE = () => () => {};
const NONE = () => null;

/** The signed-in account's stores, or null on public pages and for visitors. */
export function useAccountStores() {
  return useContext(AccountContext);
}

/** The account, or null on public pages and for visitors. */
export function useAccount() {
  const context = useContext(AccountContext);
  const access = useSyncExternalStore(context?.access.subscribe ?? EMPTY_SUBSCRIBE, context?.access.getSnapshot ?? NONE, context?.access.getSnapshot ?? NONE);
  const list = useSyncExternalStore(context?.watchlist.subscribe ?? EMPTY_SUBSCRIBE, context?.watchlist.getSnapshot ?? NONE, context?.watchlist.getSnapshot ?? NONE);
  const saving = useMemo(
    () => new Set([...(list?.pending ?? [])].filter((key) => key.startsWith("watchlist.")).map((key) => key.slice("watchlist.".length))),
    [list?.pending],
  );
  if (!context || !list) return null;
  const { watchlist, requestUpgrade } = context;
  return {
    userID: context.userID,
    watchlist: list.order,
    access,
    /** Instruments whose membership is being saved. */
    saving,
    unlocksPlus: unlocks(access, "plus"),
    unlocksPro: unlocks(access, "pro"),
    isWatched: (id: string) => list.order.includes(id),
    requestUpgrade,
    applyAccess: (next: SubscriptionAccess | null) => context.access.apply(next),
    /** Stars or unstars at once; the save follows in order, a plan limit opens the plan dialog. */
    toggleWatched: (id: string) => watchlist.setWatched(id, !list.order.includes(id)),
  };
}

export type Account = NonNullable<ReturnType<typeof useAccount>>;

export function AccountProvider({ initial, children }: { initial: AccountInitial; children: ReactNode }) {
  const t = useTranslations();
  const toast = useToast();
  // The reason stays after closing so the dialog does not go blank while it animates out.
  const [reason, setReason] = useState<UpgradeReason | null>(null);
  const [open, setOpen] = useState(false);
  const requestUpgrade = useCallback((next: UpgradeReason) => {
    setReason(next);
    setOpen(true);
  }, []);
  const [value] = useState<AccountContextValue>(() => {
    const access = new AccessStore(initial.userID, initial.access);
    const watchlist = new WatchlistStore(accountWatchlistRepository(initial.userID), appErrors, initial.watchlist, {
      upgrade: (next) => requestUpgrade(next),
      accessChanged: (next) => (next ? access.apply(next) : access.refreshSoon()),
    });
    const alerts = new AlertsStore(accountAlertRepository(initial.userID), appErrors, (next) => requestUpgrade(next));
    const activity = new ActivityStore(accountActivityRepository(initial.userID), appErrors, initial.hasUnread, {
      // New rows while the site is open: one quiet toast that never carries a threshold or an amount.
      arrived: () => {
        if (!appErrors.current) toast.show({ title: t("common.activity"), message: t("common.newInformationNotification") });
      },
    });
    const preferences = new PreferencesStore(accountPreferencesRepository(initial.userID), appErrors);
    const portfolio = new PortfolioStore(accountPortfolioRepository(initial.userID), appErrors, (next) => requestUpgrade(next));
    return { userID: initial.userID, access, watchlist, alerts, activity, preferences, portfolio, requestUpgrade };
  });

  // The bell and the inbox: re-read every minute while the tab is visible, and on return after a minute away.
  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;
      const { loadedAt } = value.activity.getSnapshot();
      if (loadedAt === null || Date.now() - loadedAt >= ACTIVITY_REFRESH_MS - 1000) void value.activity.load({ quiet: true });
    };
    const timer = setInterval(refresh, ACTIVITY_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [value]);

  useEffect(() => {
    let controller: AbortController | undefined;
    const onVisibility = () => {
      controller?.abort();
      if (document.hidden) return;
      controller = new AbortController();
      // Another device may have changed the account meanwhile.
      if (value.watchlist.getSnapshot().status === "loaded") void value.watchlist.load(true);
      else value.access.refreshSoon();
      if (value.alerts.getSnapshot().status === "loaded") void value.alerts.load(controller.signal, true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      controller?.abort();
    };
  }, [value]);

  return (
    <AccountContext.Provider value={value}>
      {children}
      <Dialog
        variant="dialog"
        open={open}
        onClose={() => setOpen(false)}
        title={reason ? t(upgradeTier(reason) === "pro" ? "subscriptions.management.proTitle" : "subscriptions.management.plusTitle") : ""}
        footer={
          <Button kind="secondary" className="w-full" onClick={() => setOpen(false)}>
            {t("common.ok")}
          </Button>
        }
      >
        <p className="text-body text-primary-text" data-testid="upgrade-reason">
          {reason ? t(UPGRADE_REASON_KEYS[reason]) : null}
        </p>
      </Dialog>
    </AccountContext.Provider>
  );
}
