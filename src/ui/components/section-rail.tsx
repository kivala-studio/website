"use client";

import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";

import { cn } from "../cn";
import { Icon, type IconName } from "../icons/icon";

import { useLinkCurrent } from "./controls";

export type RailItem = {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  /** Overrides the path match (an overview that also owns its detail pages): `page` on itself, `true` above one. */
  current?: "page" | "true" | false;
  testID?: string;
};

/** The rail tile look: icon over a short label, a raised card when current. For a `leading` control styled as one. */
export const RAIL_TILE =
  "flex min-h-16 w-full min-w-20 flex-col items-center justify-center gap-1 rounded-large px-2 py-2 text-center text-caption font-medium transition-colors";
export const RAIL_TILE_IDLE = "text-secondary-text hover:bg-action-surface hover:text-primary-text";

/**
 * A section's own navigation (the portfolio area): icon-over-label items in a narrow vertical rail from 1024 px,
 * a horizontally scrollable strip below it. The current item is a raised card and carries `aria-current`.
 * `leading` sits above the items (beside them on the strip, outside its scroller, so a menu it opens is not
 * clipped): a switcher such as CoinStats' "All Assets" tile.
 * Place it in a `lg:grid-cols-[auto_minmax(0,1fr)]` grid next to the section's content.
 */
export function SectionRail({ items, label, leading, className }: { items: readonly RailItem[]; label: string; leading?: ReactNode; className?: string }) {
  const current = useLinkCurrent();
  return (
    <nav aria-label={label} className={cn("flex min-w-0 gap-1 lg:sticky lg:top-20 lg:w-24 lg:flex-col lg:gap-3 lg:self-start", className)}>
      {leading ? <div className="flex w-24 shrink-0">{leading}</div> : null}
      <ul className="-mr-4 flex min-w-0 flex-1 gap-1 overflow-x-auto pr-4 pb-1 [scrollbar-width:none] sm:-mr-6 sm:pr-6 lg:mr-0 lg:flex-col lg:overflow-visible lg:pr-0 lg:pb-0">
        {items.map((item) => {
          const state = item.current !== undefined ? item.current || undefined : current(item.href, item.exact);
          return (
            <li key={item.href} className="flex shrink-0">
              <Link
                href={item.href}
                aria-current={state}
                data-testid={item.testID}
                className={cn(RAIL_TILE, state ? "bg-raised text-primary-text shadow-raised" : RAIL_TILE_IDLE)}
              >
                <Icon name={item.icon} scale="l" className={cn(state && "text-accent")} />
                <span className="max-w-full font-display leading-tight">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
