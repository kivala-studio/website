"use client";

import { useTranslations } from "next-intl";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { type SubscriptionAccess, decodeSubscriptionAccess, unlocks } from "@/domain/account/access";
import { AppError, UPGRADE_REASON_KEYS, type UpgradeReason } from "@/domain/errors";
import { upgradeTier } from "@/domain/errors/rules";
import { appErrors } from "@/features/errors/error-presenter";
import { Button } from "@/ui/components/buttons";
import { Dialog } from "@/ui/components/dialog";

import { type AccountResult, setWatched } from "./actions";

export type AccountSnapshot = {
  readonly userID: string;
  readonly watchlist: readonly string[];
  readonly access: SubscriptionAccess | null;
  /** Instruments whose star is being saved. */
  readonly saving: ReadonlySet<string>;
};

/**
 * The signed-in account in this tab (iOS `WatchlistStore` + `SubscriptionStore`, the parts W7 needs): the
 * watchlist in order and the plan access. Reads come from `/api/account/state`, writes are server actions;
 * every result is applied only while the tab still belongs to the same account.
 */
class AccountStore {
  private state: AccountSnapshot;
  private readonly listeners = new Set<() => void>();

  constructor(initial: Omit<AccountSnapshot, "saving">) {
    this.state = { ...initial, saving: new Set() };
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.state;

  private set(change: Partial<AccountSnapshot>) {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }

  /** Re-reads the account when the tab returns; a failure keeps what is shown. */
  async refresh(signal: AbortSignal): Promise<void> {
    const userID = this.state.userID;
    try {
      const response = await fetch("/api/account/state", { cache: "no-store", signal });
      if (!response.ok) return;
      const body = (await response.json()) as { userID?: unknown; watchlist?: unknown; access?: unknown };
      if (body.userID !== userID || this.state.userID !== userID || !Array.isArray(body.watchlist)) return;
      this.set({
        watchlist: body.watchlist.filter((id): id is string => typeof id === "string"),
        access: decodeAccessJSON(body.access) ?? this.state.access,
      });
    } catch {
      // Not shown: the next return to the tab tries again.
    }
  }

  /** Applies a server's access document (comparison authorisation returns one). */
  applyAccess(access: SubscriptionAccess | null) {
    if (access) this.set({ access });
  }

  /** Saves one star. Returns the refusal, if any, for the caller to present. */
  async setWatched(id: string, watched: boolean): Promise<AccountResult<unknown>> {
    const userID = this.state.userID;
    this.set({ saving: new Set([...this.state.saving, id]) });
    const result = await setWatched(userID, id, watched).catch(
      (): AccountResult<never> => ({ status: "failed", error: { category: "connectionLost", httpStatus: null, rule: null } }),
    );
    const saving = new Set(this.state.saving);
    saving.delete(id);
    if (this.state.userID !== userID) return { status: "stale" };
    if (result.status === "ok") this.set({ saving, watchlist: result.value.watchlist, access: result.value.access ?? this.state.access });
    else this.set({ saving });
    return result;
  }
}

/** The access document as `/api/account/state` sends it (already decoded on the server). */
function decodeAccessJSON(value: unknown): SubscriptionAccess | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.isPlus !== "boolean" || typeof row.enforcementEnabled !== "boolean") return null;
  return decodeSubscriptionAccess({
    is_plus: row.isPlus,
    is_pro: row.isPro,
    enforcement_enabled: row.enforcementEnabled,
    week_start: row.weekStart,
    resets_at: row.resetsAt,
    comparison_pair: row.comparisonPair,
    active_watchlist_ids: row.activeWatchlistIDs,
    movement_security_id: row.movementSecurityID,
  });
}

type AccountContextValue = {
  store: AccountStore;
  /** Opens the neutral plan dialog with the reason sentence (the plans page arrives in W16). */
  requestUpgrade: (reason: UpgradeReason) => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);

/** The account, or null on public pages and for visitors. */
export function useAccount() {
  const context = useContext(AccountContext);
  const fallback = useMemo(() => new AccountStore({ userID: "", watchlist: [], access: null }), []);
  const state = useSyncExternalStore((context?.store ?? fallback).subscribe, (context?.store ?? fallback).getSnapshot, (context?.store ?? fallback).getSnapshot);
  if (!context) return null;
  const { store, requestUpgrade } = context;
  return {
    ...state,
    unlocksPlus: unlocks(state.access, "plus"),
    unlocksPro: unlocks(state.access, "pro"),
    isWatched: (id: string) => state.watchlist.includes(id),
    requestUpgrade,
    applyAccess: (access: SubscriptionAccess | null) => store.applyAccess(access),
    /** Toggles a star; a tier limit opens the plan dialog, other failures the shared error toast. */
    toggleWatched: async (id: string) => {
      const watched = !state.watchlist.includes(id);
      const result = await store.setWatched(id, watched);
      if (result.status !== "failed") return;
      const upgrade = result.error.rule?.upgrade;
      if (upgrade) return requestUpgrade(upgrade.reason);
      const { category, httpStatus, rule } = result.error;
      appErrors.present(new AppError(category, { operation: "watchlist.update", httpStatus, rule }), "watchlist.update", {
        retry: () => store.setWatched(id, watched),
      });
    },
  };
}

export type Account = NonNullable<ReturnType<typeof useAccount>>;

export function AccountProvider({ initial, children }: { initial: Omit<AccountSnapshot, "saving">; children: ReactNode }) {
  const t = useTranslations();
  const [store] = useState(() => new AccountStore(initial));
  // The reason stays after closing so the dialog does not go blank while it animates out.
  const [reason, setReason] = useState<UpgradeReason | null>(null);
  const [open, setOpen] = useState(false);
  const requestUpgrade = useCallback((next: UpgradeReason) => {
    setReason(next);
    setOpen(true);
  }, []);
  const value = useMemo(() => ({ store, requestUpgrade }), [store, requestUpgrade]);

  useEffect(() => {
    let controller: AbortController | undefined;
    const onVisibility = () => {
      if (document.hidden) return controller?.abort();
      controller = new AbortController();
      void store.refresh(controller.signal);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      controller?.abort();
    };
  }, [store]);

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
