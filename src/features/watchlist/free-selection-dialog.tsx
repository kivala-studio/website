"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useSyncExternalStore } from "react";

import { FREE_PLAN_LIMITS } from "@/domain/account/access";
import { useAccount, useAccountStores } from "@/features/account/account-provider";
import type { CatalogueRow } from "@/features/market/browse/price-cell";
import { cn } from "@/ui/cn";
import { Button } from "@/ui/components/buttons";
import { Dialog } from "@/ui/components/dialog";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

/**
 * `Plano gratuito` (iOS `FreePlanSelectionView`): up to three active instruments and one for automatic
 * movements (`select_free_watchlist`). The rest stay saved and paused. Mounted while open.
 */
export function FreeSelectionDialog({ onClose, rows }: { onClose: () => void; rows: ReadonlyMap<string, CatalogueRow> }) {
  const t = useTranslations();
  const format = useFormat();
  const stores = useAccountStores()!;
  const account = useAccount()!;
  const list = useSyncExternalStore(stores.watchlist.subscribe, stores.watchlist.getSnapshot, stores.watchlist.getSnapshot);
  const movementID = useId();
  const [chosen, setChosen] = useState<string[]>(() =>
    list.order.filter((id) => account.access?.activeWatchlistIDs.includes(id)).slice(0, FREE_PLAN_LIMITS.watchlist),
  );
  const [movement, setMovement] = useState<string>(account.access?.movementSecurityID ?? "");
  const [result, setResult] = useState<"saved" | "failed" | "saving" | null>(null);

  const required = Math.min(FREE_PLAN_LIMITS.watchlist, list.order.length);
  const toggle = (id: string) => {
    setResult(null);
    setChosen((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return current.length >= FREE_PLAN_LIMITS.watchlist ? current : [...current, id];
    });
  };
  const movementValue = chosen.includes(movement) ? movement : "";

  const save = async () => {
    setResult("saving");
    try {
      await stores.watchlist.selectFree(chosen, movementValue || null);
      setResult("saved");
    } catch {
      setResult("failed");
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("subscriptions.freeSelection.title")}
      footer={
        <div className="flex flex-col gap-2">
          {result === "saved" || result === "failed" ? (
            <p role="status" className={cn("text-secondary", result === "failed" ? "text-negative" : "text-secondary-text")}>
              {t(result === "saved" ? "subscriptions.freeSelection.saved" : "subscriptions.freeSelection.saveError")}
            </p>
          ) : null}
          <Button onClick={() => void save()} loading={result === "saving"} disabled={chosen.length !== required} data-testid="save-free-selection">
            {t("subscriptions.freeSelection.saveButton")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5" data-testid="free-selection">
        <p className="text-body text-primary-text">{t("subscriptions.freeSelection.instructions")}</p>
        {account.access?.isPlus ? <p className="text-secondary text-secondary-text">{t("subscriptions.freeSelection.plusNote")}</p> : null}
        <fieldset className="flex flex-col">
          <legend className="pb-2 text-secondary font-semibold text-secondary-text">
            {t("subscriptions.freeSelection.activeHeader", { arg1: format.count(chosen.length) })}
          </legend>
          {list.order.map((id) => {
            const checked = chosen.includes(id);
            const row = rows.get(id);
            return (
              <button
                key={id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(id)}
                className="flex min-h-12 items-center gap-3 border-b border-hairline text-left last:border-b-0"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body font-semibold text-primary-text">{row?.symbol ?? id}</span>
                  <span className="text-caption text-secondary-text">{t(checked ? "subscriptions.freeSelection.active" : "subscriptions.freeSelection.paused")}</span>
                </span>
                <Icon name={checked ? "check-circle" : "add"} className={checked ? "text-accent" : "text-tertiary-text"} />
              </button>
            );
          })}
        </fieldset>
        <label htmlFor={movementID} className="flex flex-col gap-2">
          <span className="text-secondary font-semibold text-secondary-text">{t("common.automaticMovements")}</span>
          <select
            id={movementID}
            value={movementValue}
            onChange={(event) => {
              setMovement(event.target.value);
              setResult(null);
            }}
            className="min-h-11 rounded-medium bg-elevated-background px-3 text-body text-primary-text"
          >
            <option value="">{t("subscriptions.freeSelection.noneOption")}</option>
            {chosen.map((id) => (
              <option key={id} value={id}>
                {rows.get(id)?.symbol ?? id}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Dialog>
  );
}
