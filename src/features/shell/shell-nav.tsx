"use client";

import { type ReactNode, useSyncExternalStore } from "react";

import { useAccountStores } from "@/features/account/account-provider";

import { Link, useDestinationPathname } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { INDICATOR_FILL, INDICATOR_IDLE, TOP_BAR_FLOAT } from "@/ui/components/button-styles";
import { iconButtonClass } from "@/ui/components/buttons";
import { TopBar } from "@/ui/components/top-bar";
import { Icon, type IconName } from "@/ui/icons/icon";
import { useSlidingIndicator } from "@/ui/motion/use-sliding-indicator";

import { isCurrentTab, SEARCH_TAB } from "./destinations";

type Item = { href: string; label: string; icon: IconName };

/**
 * The phone tab bar (iOS tab bar) below 1024 px; the current tab is marked `aria-current="page"` and sits on a soft
 * accent capsule that glides to the next tab (as on iOS) the moment it is pressed, while its page is on its way.
 */
export function ShellNav({ items, label }: { items: readonly Item[]; label: string }) {
  const pathname = useDestinationPathname();
  const list = useSlidingIndicator<HTMLUListElement>(pathname, { selector: "[aria-current]", memory: `tab-bar:${label}` });
  return (
    <nav aria-label={label} className="fixed inset-x-0 bottom-0 z-20 border-t border-separator bg-canvas pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul ref={list} className="mx-auto grid max-w-xl grid-cols-5 px-1">
        {items.map((item) => {
          const current = isCurrentTab(item.href, pathname);
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "motion-press flex min-h-16 flex-col items-center justify-center gap-1 rounded-full px-1 text-micro font-medium tracking-normal",
                  current ? cn(INDICATOR_FILL, "text-accent before:inset-x-0.5 before:inset-y-1.5 before:bg-accent-soft") : cn(INDICATOR_IDLE, "text-secondary-text"),
                )}
              >
                <Icon name={item.icon} scale="l" className={cn("transition-colors", current && "text-accent")} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type TopBarProps = {
  tabs: readonly Item[];
  navLabel: string;
  homeLabel: string;
  logo: ReactNode;
  initials: string;
  profileLabel: string;
  unusualLabel: string;
  activityLabel: string;
  /** The bell's accessible state: something new, or nothing new. */
  activityStates: { readonly new: string; readonly none: string };
  search?: ReactNode;
};

const NO_SUBSCRIPTION = () => () => {};

/**
 * The app's top bar: the tabs as pills (the search tab is the field here), the search palette, unusual activity,
 * the bell (a dot when something is unread) and the profile initials. Below 1024 px it keeps the logo, a search
 * button and the icons; the tabs move to the bottom bar.
 */
export function ShellTopBar({ tabs, navLabel, homeLabel, logo, initials, profileLabel, unusualLabel, activityLabel, activityStates, search }: TopBarProps) {
  const pathname = useDestinationPathname();
  const activity = useAccountStores()?.activity;
  const hasUnread = useSyncExternalStore(
    activity?.subscribe ?? NO_SUBSCRIPTION,
    () => activity?.getSnapshot().hasNew ?? false,
    () => false,
  );
  const current = (href: string) => (isCurrentTab(href, pathname) ? ("page" as const) : undefined);
  return (
    <TopBar
      home={{ href: "/inicio", label: homeLabel }}
      logo={logo}
      nav={tabs.filter((tab) => tab.href !== SEARCH_TAB).map(({ href, label }) => ({ href, label }))}
      navLabel={navLabel}
      mobileNav="none"
      search={search}
      actions={
        <>
          <Link href="/atividade-invulgar" aria-current={current("/atividade-invulgar")} className={iconButtonClass("surface", cn(TOP_BAR_FLOAT, "aria-[current=page]:bg-accent-soft"))}>
            <Icon name="chart" label={unusualLabel} scale="l" />
          </Link>
          <Link href="/atividade" aria-current={current("/atividade")} className={iconButtonClass("surface", cn(TOP_BAR_FLOAT, "aria-[current=page]:bg-accent-soft"))}>
            <Icon name="notification" scale="l" />
            <span className="sr-only">{`${activityLabel}, ${hasUnread ? activityStates.new : activityStates.none}`}</span>
            {/* Always drawn, so a new unread item grows the dot in and reading it shrinks it away. */}
            <span
              aria-hidden
              data-hidden={hasUnread ? undefined : true}
              className="motion-appear absolute top-2 right-2 size-2.5 rounded-full bg-negative ring-2 ring-card-background"
            />
          </Link>
          {/* The initials are decorative: the link is named by the profile label. The 44 px target overhangs the
              gutter by 4 px, so the disc ends on the page's edge. */}
          <Link href="/definicoes" aria-current={current("/definicoes")} className="group -mr-1 ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full">
            <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-full bg-accent-soft font-display text-secondary font-semibold text-accent ring-accent group-hover:ring-2 group-aria-[current=page]:ring-2">
              {initials}
            </span>
            <span className="sr-only">{profileLabel}</span>
          </Link>
        </>
      }
    />
  );
}
