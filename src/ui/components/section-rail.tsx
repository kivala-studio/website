"use client";

import { Link } from "@/i18n/navigation";

import { cn } from "../cn";
import { Icon, type IconName } from "../icons/icon";

import { useLinkCurrent } from "./controls";

export type RailItem = { href: string; label: string; icon: IconName; exact?: boolean };

/**
 * A section's own navigation (the portfolio area): icon-over-label items in a narrow vertical rail from 1024 px,
 * a horizontally scrollable strip below it. The current item is a raised card and carries `aria-current`.
 * Place it in a `lg:grid-cols-[auto_minmax(0,1fr)]` grid next to the section's content.
 */
export function SectionRail({ items, label, className }: { items: readonly RailItem[]; label: string; className?: string }) {
  const current = useLinkCurrent();
  return (
    <nav aria-label={label} className={cn("min-w-0 lg:sticky lg:top-20 lg:self-start", className)}>
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:w-24 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {items.map((item) => {
          const state = current(item.href, item.exact);
          return (
            <li key={item.href} className="flex shrink-0">
              <Link
                href={item.href}
                aria-current={state}
                className={cn(
                  "flex min-h-16 w-full min-w-20 flex-col items-center justify-center gap-1 rounded-large px-2 py-2 text-center text-caption font-medium transition-colors",
                  state ? "bg-raised text-primary-text shadow-raised" : "text-secondary-text hover:bg-action-surface hover:text-primary-text",
                )}
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
