"use client";

import { useTranslations } from "next-intl";

import { useAccount } from "@/features/account/account-provider";
import { cn } from "@/ui/cn";
import { Icon } from "@/ui/icons/icon";

/**
 * The watchlist star (iOS search row and asset toolbar). Pressed state is the membership; a Free limit opens
 * the plan dialog. Nothing for visitors.
 */
export function WatchStar({ id, symbol, variant = "row" }: { id: string; symbol: string; variant?: "row" | "toolbar" }) {
  const t = useTranslations();
  const account = useAccount();
  if (!account) return null;
  const watched = account.isWatched(id);
  const saving = account.saving.has(id);
  const label =
    variant === "row"
      ? t(watched ? "search.accessibility.removeFromWatchlist" : "search.accessibility.addToWatchlist", { arg1: symbol })
      : t(watched ? "common.removeFromWatchlist" : "common.addToWatchlist");
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={watched}
      aria-busy={saving || undefined}
      disabled={saving}
      onClick={() => void account.toggleWatched(id)}
      data-testid="watch-star"
      className={cn(
        "motion-press inline-flex size-11 shrink-0 items-center justify-center rounded-full text-accent disabled:opacity-60",
        variant === "toolbar" && "bg-action-surface",
      )}
    >
      <Icon name="watchlist" scale="l" fill={watched ? "currentColor" : "none"} />
    </button>
  );
}
