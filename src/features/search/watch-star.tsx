"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { useAccount } from "@/features/account/account-provider";
import { iconButtonClass } from "@/ui/components/button-styles";
import { Icon } from "@/ui/icons/icon";
import { type ChangeAnimation, useChangeAnimation } from "@/ui/motion/use-change-animation";

/** Added: the star grows in as it fills. Removed: only the fill fades (CSS). */
const STAR_ADDED: ChangeAnimation = {
  keyframes: [{ transform: "scale(0.6)" }, { transform: "none" }],
  duration: "base",
  easing: "emphasized",
};

/**
 * The watchlist star (iOS search row and asset toolbar). Pressed state is the membership; a Free limit opens
 * the plan dialog. Nothing for visitors. Adding grows the star in as it fills; removing fades the fill.
 */
export function WatchStar({ id, symbol, variant = "row" }: { id: string; symbol: string; variant?: "row" | "toolbar" }) {
  const t = useTranslations();
  const account = useAccount();
  const star = useRef<SVGSVGElement>(null);
  // Only a press animates: the watchlist arriving after load fills the stars in place.
  const pressed = useRef(false);
  const watched = account?.isWatched(id) ?? false;
  useChangeAnimation(star, watched, (_before, after) => {
    const animate = after && pressed.current;
    pressed.current = false;
    return animate ? STAR_ADDED : null;
  });
  if (!account) return null;
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
      onClick={() => {
        pressed.current = true;
        void account.toggleWatched(id);
      }}
      data-testid="watch-star"
      className={
        variant === "toolbar"
          ? iconButtonClass("filled", "text-accent! disabled:opacity-60")
          : "motion-press inline-flex size-11 shrink-0 items-center justify-center rounded-full text-accent disabled:opacity-60"
      }
    >
      <Icon ref={star} name="watchlist" scale="l" fill={watched ? "currentColor" : "none"} className="transition-[fill] duration-base" />
    </button>
  );
}
