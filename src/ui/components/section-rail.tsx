"use client";

import type { ReactNode } from "react";

import { Link, useDestinationPathname } from "@/i18n/navigation";

import { cn } from "../cn";
import { Icon, type IconName } from "../icons/icon";
import { useSlidingIndicator } from "../motion/use-sliding-indicator";

import { INDICATOR_FILL, INDICATOR_IDLE } from "./button-styles";
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
  "motion-press flex min-h-16 w-full min-w-20 flex-col items-center justify-center gap-1 rounded-large px-2 py-2 text-center text-caption font-medium";
export const RAIL_TILE_IDLE = "text-secondary-text hover:bg-action-surface hover:text-primary-text";
/** The current tile: the raised card is its `::before`, so it glides along the rail to the next current tile. */
const RAIL_TILE_CURRENT = cn(INDICATOR_FILL, "text-primary-text before:bg-raised before:shadow-raised");

/**
 * A section's own navigation (the portfolio area): icon-over-label items in a narrow vertical rail from 1024 px,
 * a horizontally scrollable strip below it. The current item is a raised card and carries `aria-current`.
 * `leading` sits above the items (beside them on the strip, outside its scroller, so a menu it opens is not
 * clipped): a switcher such as CoinStats' "All Assets" tile.
 * Place it in a `lg:grid-cols-[auto_minmax(0,1fr)]` grid next to the section's content.
 */
export function SectionRail({ items, label, leading, className }: { items: readonly RailItem[]; label: string; leading?: ReactNode; className?: string }) {
  const current = useLinkCurrent();
  const pathname = useDestinationPathname();
  const states = items.map((item) => (item.current !== undefined ? item.current || undefined : current(item.href, item.exact)));
  const list = useSlidingIndicator<HTMLUListElement>(`${pathname}|${states.join()}`, { selector: "[aria-current]", memory: `rail:${label}` });
  return (
    <nav aria-label={label} className={cn("flex min-w-0 gap-1 lg:sticky lg:top-[calc(var(--top-bar-height)+1rem)] lg:w-24 lg:flex-col lg:gap-3 lg:self-start", className)}>
      {leading ? <div className="flex w-24 shrink-0">{leading}</div> : null}
      <ul ref={list} className="-mr-4 flex min-w-0 flex-1 gap-1 overflow-x-auto pr-4 pb-1 [scrollbar-width:none] sm:-mr-6 sm:pr-6 lg:mr-0 lg:flex-col lg:overflow-visible lg:pr-0 lg:pb-0">
        {items.map((item, index) => {
          const state = states[index];
          return (
            <li key={item.href} className="flex shrink-0">
              <Link
                href={item.href}
                aria-current={state}
                data-testid={item.testID}
                className={cn(RAIL_TILE, state ? RAIL_TILE_CURRENT : cn(INDICATOR_IDLE, RAIL_TILE_IDLE))}
              >
                <Icon name={item.icon} scale="l" className={cn("transition-colors", state && "text-accent")} />
                <span className="max-w-full font-display leading-tight">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
