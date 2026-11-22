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

export type ShellChromeProps = {
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

/** Whether the activity inbox has something unread (the bell's dot). */
function useHasUnread() {
  const activity = useAccountStores()?.activity;
  return useSyncExternalStore(
    activity?.subscribe ?? NO_SUBSCRIPTION,
    () => activity?.getSnapshot().hasNew ?? false,
    () => false,
  );
}

/**
 * The app's top bar below 1024 px (the sidebar takes its place from there): the logo, the search button, unusual
 * activity, the bell (a dot when something is unread) and the profile initials; the tabs are in the bottom bar.
 */
export function ShellTopBar({ tabs, navLabel, homeLabel, logo, initials, profileLabel, unusualLabel, activityLabel, activityStates, search }: ShellChromeProps) {
  const pathname = useDestinationPathname();
  const hasUnread = useHasUnread();
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

/** A row of the sidebar: icon and label; the current one sits on the soft accent fill, which glides to the next. */
const SIDEBAR_ROW = "motion-press flex min-h-11 items-center gap-3 rounded-full px-3 font-display text-body";

/**
 * The app's navigation from 1024 px: a card down the window's left edge, sticky while the page scrolls. The logo, the
 * search field, the tabs (the search tab is the field), then unusual activity and the activity inbox (a dot when
 * something is unread), and the profile at the foot. Below 1024 px the top bar and the bottom tab bar take over.
 */
export function ShellSidebar({
  tabs,
  navLabel,
  homeLabel,
  logo,
  name,
  initials,
  profileLabel,
  unusualLabel,
  activityLabel,
  activityStates,
  search,
}: ShellChromeProps & { name: string }) {
  const pathname = useDestinationPathname();
  const hasUnread = useHasUnread();
  const list = useSlidingIndicator<HTMLUListElement>(pathname, { selector: "[aria-current]", memory: `sidebar:${navLabel}` });
  const items = [
    ...tabs.filter((tab) => tab.href !== SEARCH_TAB),
    { href: "/atividade-invulgar", label: unusualLabel, icon: "chart" as const },
    { href: "/atividade", label: activityLabel, icon: "notification" as const },
  ];
  const profileCurrent = isCurrentTab("/definicoes", pathname);
  return (
    <aside className="sticky top-3 m-3 mr-0 hidden self-start h-[calc(100dvh-1.5rem)] w-60 shrink-0 flex-col gap-4 rounded-card bg-card-background p-3 lg:flex">
      <Link href="/inicio" aria-label={homeLabel} className="inline-flex min-h-12 items-center gap-2 self-start rounded-full px-2 text-primary-text">
        {logo}
      </Link>
      {search}
      <nav aria-label={navLabel} className="min-h-0 flex-1 overflow-y-auto">
        <ul ref={list} className="flex flex-col gap-1">
          {items.map((item) => {
            const current = isCurrentTab(item.href, pathname);
            const bell = item.href === "/atividade";
            return (
              <li key={item.href} className={cn(item.href === "/atividade-invulgar" && "mt-3 border-t border-hairline pt-3")}>
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    SIDEBAR_ROW,
                    current ? cn(INDICATOR_FILL, "font-semibold text-primary-text before:bg-accent-soft") : cn(INDICATOR_IDLE, "font-medium text-primary-text hover:bg-accent-soft/60"),
                  )}
                >
                  <Icon name={item.icon} scale="l" className={cn("transition-colors", current ? "text-accent" : "text-secondary-text")} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {bell ? (
                    <>
                      <span className="sr-only">{hasUnread ? activityStates.new : activityStates.none}</span>
                      <span aria-hidden data-hidden={hasUnread ? undefined : true} className="motion-appear size-2.5 shrink-0 rounded-full bg-negative" />
                    </>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Link
        href="/definicoes"
        aria-current={profileCurrent ? "page" : undefined}
        aria-label={profileLabel}
        className={cn(SIDEBAR_ROW, "px-1.5 font-medium text-primary-text hover:bg-accent-soft/60 aria-[current=page]:bg-accent-soft")}
      >
        <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-secondary font-semibold text-accent">
          {initials}
        </span>
        <span aria-hidden className="min-w-0 truncate">{name}</span>
      </Link>
    </aside>
  );
}
