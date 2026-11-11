"use client";

import type { ReactNode } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { Icon, type IconName } from "@/ui/icons/icon";

import { isCurrentTab } from "./destinations";

type Item = { href: string; label: string; icon: IconName };

/** The tabs; the current one is marked `aria-current="page"`, which screen readers announce. */
export function ShellNav({ items, label, variant }: { items: readonly Item[]; label: string; variant: "sidebar" | "bar" }) {
  const pathname = usePathname();
  const bar = variant === "bar";
  return (
    <nav
      aria-label={label}
      className={cn(
        bar
          ? "fixed inset-x-0 bottom-0 z-20 border-t border-separator bg-app-background pb-[env(safe-area-inset-bottom)] lg:hidden"
          : "flex flex-col",
      )}
    >
      <ul className={cn(bar ? "mx-auto grid max-w-xl grid-cols-5" : "flex flex-col gap-1")}>
        {items.map((item) => {
          const current = isCurrentTab(item.href, pathname);
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-medium font-medium",
                  bar
                    ? "min-h-16 flex-col justify-center gap-1 px-1 text-micro tracking-normal"
                    : "gap-3 px-3 py-2 text-body desk:py-1.5",
                  current ? (bar ? "text-accent" : "bg-selected-tab-background text-primary-text") : "text-secondary-text",
                )}
              >
                <Icon name={item.icon} scale={bar ? "l" : "m"} className={cn(current && "text-accent")} />
                <span className={cn(bar && "max-w-full truncate")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type HeaderProps = {
  initials: string;
  profileLabel: string;
  unusualLabel: string;
  activityLabel: string;
  activityState: string;
  hasUnread: boolean;
  search?: ReactNode;
};

const HEADER_LINK = "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-primary-text";

/**
 * Profile initials (to the profile page), unusual activity and the bell, which shows a dot when there is something
 * unread. From 1024 px it is the web top bar: the search field first, the profile last.
 */
export function ShellHeader({ initials, profileLabel, unusualLabel, activityLabel, activityState, hasUnread, search }: HeaderProps) {
  const pathname = usePathname();
  const current = (href: string) => (isCurrentTab(href, pathname) ? ("page" as const) : undefined);
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 bg-app-background px-4 py-2 sm:px-6 lg:min-h-14 lg:gap-3 lg:border-b lg:border-hairline lg:bg-elevated-background">
      {/* The initials are decorative: the link is named by the profile label. */}
      <Link href="/definicoes" aria-current={current("/definicoes")} className={cn(HEADER_LINK, "bg-action-surface text-secondary font-semibold lg:order-last")}>
        <span aria-hidden>{initials}</span>
        <span className="sr-only">{profileLabel}</span>
      </Link>
      <div className="flex min-w-0 flex-1">{search}</div>
      <div className="flex items-center gap-1">
        <Link href="/atividade-invulgar" aria-current={current("/atividade-invulgar")} className={HEADER_LINK}>
          <Icon name="chart" label={unusualLabel} scale="l" />
        </Link>
        <Link href="/atividade" aria-current={current("/atividade")} className={HEADER_LINK}>
          <Icon name="notification" scale="l" />
          <span className="sr-only">{`${activityLabel}, ${activityState}`}</span>
          {hasUnread ? <span aria-hidden className="absolute top-2 right-2 size-2.5 rounded-full bg-negative ring-2 ring-app-background" /> : null}
        </Link>
      </div>
    </header>
  );
}
