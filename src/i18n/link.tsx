"use client";

import { createNavigation } from "next-intl/navigation";
import { useLinkStatus } from "next/link";
import { type ComponentProps, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { routing } from "./routing";

const { Link: LocaleLink, usePathname } = createNavigation(routing);

type LocaleLinkProps = ComponentProps<typeof LocaleLink>;

/*
 * The page a link is taking the visitor to, while it is on its way: set by the link whose navigation is pending
 * (`useLinkStatus`), cleared once the history has moved (the new page or its `loading.tsx` skeleton is there).
 * Navigation groups read it through `useDestinationPathname`, so the pressed tab is current at once.
 */
let pendingPath: string | null = null;
const listeners = new Set<() => void>();
const setPendingPath = (path: string | null) => {
  if (pendingPath === path) return;
  pendingPath = path;
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
// Back or Forward while a page is on its way: the visitor went elsewhere, so nothing is pending any more.
if (typeof window !== "undefined") window.addEventListener("popstate", () => setPendingPath(null));

/** The locale-less path of an href, without its query and hash (`/mercado/BAI`). */
function pathOf(href: LocaleLinkProps["href"]): string | null {
  const raw = typeof href === "string" ? href : href.pathname;
  if (!raw || !raw.startsWith("/")) return null;
  return raw.split(/[?#]/)[0];
}

/**
 * The path the visitor is on, or the one a link is taking them to while its page is on its way. Navigation groups
 * (the top bar, the tab bar, rails, tabs) mark the current item with it, so the pressed item is current in the same
 * frame and the indicator glides to it at once.
 */
export function useDestinationPathname(): string {
  const pathname = usePathname();
  return usePendingPathname() ?? pathname;
}

/** The locale-less path a link is taking the visitor to while its page is on its way; `null` otherwise. */
export function usePendingPathname(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => pendingPath,
    () => null,
  );
}

/**
 * Rendered inside every link: while the link's navigation is pending it publishes the destination and draws a
 * hidden `[data-link-pending]` marker, so CSS keeps the link pressed (`motion-tap`, `motion-press`, table rows)
 * until the new page or its skeleton is there.
 */
function PendingMarker({ path }: { path: string | null }) {
  const { pending } = useLinkStatus();
  const published = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (pending && path) {
      published.current = path;
      setPendingPath(path);
    } else if (published.current) {
      if (pendingPath === published.current) setPendingPath(null);
      published.current = null;
    }
  }, [pending, path]);
  useLayoutEffect(
    () => () => {
      if (published.current && pendingPath === published.current) setPendingPath(null);
    },
    [],
  );
  return pending ? <span hidden data-link-pending="" /> : null;
}

type LinkProps = Omit<LocaleLinkProps, "prefetch"> & {
  /**
   * `"intent"`: no viewport prefetch; the route is prefetched once the pointer rests on the link, a finger touches it
   * or it gains focus. For long lists of links (tables, feeds), where prefetching every visible row would load the
   * server for pages nobody opens. The other values are Next.js's.
   */
  prefetch?: LocaleLinkProps["prefetch"] | "intent";
};

/**
 * The app's link: next-intl's localised `Link`, plus the pending state above and intent prefetching. Every link
 * in the app comes from here (through `@/i18n/navigation`).
 */
export function Link({ prefetch, children, onPointerEnter, onTouchStart, onFocus, ...props }: LinkProps) {
  const [intent, setIntent] = useState(false);
  const path = pathOf(props.href);
  if (prefetch !== "intent") {
    return (
      <LocaleLink {...props} prefetch={prefetch} onPointerEnter={onPointerEnter} onTouchStart={onTouchStart} onFocus={onFocus}>
        {children}
        <PendingMarker path={path} />
      </LocaleLink>
    );
  }
  return (
    <LocaleLink
      {...props}
      // `null` is Next.js's default: the link now prefetches like any other (it is in view, and the pointer is on it).
      prefetch={intent ? null : false}
      onPointerEnter={(event) => {
        setIntent(true);
        onPointerEnter?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
    >
      {children}
      <PendingMarker path={path} />
    </LocaleLink>
  );
}
