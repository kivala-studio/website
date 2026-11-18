"use client";

import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";

import { cn } from "../cn";
import { useLinkCurrent } from "./controls";

export type TopBarLink = { href: string; label: string };

/** A pill link of the top bar; the current section has the soft grey pill. */
export const TOP_BAR_PILL = "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 font-display text-secondary font-medium whitespace-nowrap transition-colors";

/**
 * The one top bar of the site and the app: full width, 64 px, sticky, on the elevated surface with a hairline
 * shadow. Logo, pill navigation, then the search and the actions on the right. Below 1024 px the navigation
 * either takes a horizontally scrollable row of its own (`mobileNav="row"`, the public site) or is left to the
 * bottom tab bar (`"none"`, the app).
 */
export function TopBar({
  home,
  logo,
  nav,
  navLabel,
  mobileNav,
  search,
  actions,
}: {
  home: { href: string; label: string };
  logo: ReactNode;
  nav: readonly TopBarLink[];
  navLabel: string;
  mobileNav: "row" | "none";
  search?: ReactNode;
  actions: ReactNode;
}) {
  const current = useLinkCurrent();
  return (
    <header className="sticky top-0 z-30 bg-elevated-background shadow-bar">
      <div className="flex flex-wrap items-center gap-x-1 px-4 sm:gap-x-2 sm:px-6 lg:flex-nowrap lg:gap-x-3">
        <Link
          href={home.href}
          prefetch={false}
          aria-label={home.label}
          className="-ml-1 inline-flex min-h-16 shrink-0 items-center gap-2 rounded-small px-1 text-primary-text"
        >
          {logo}
        </Link>
        <nav
          aria-label={navLabel}
          className={cn(
            mobileNav === "row"
              ? "order-last -mx-4 basis-[calc(100%+2rem)] overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:-mx-6 sm:basis-[calc(100%+3rem)] sm:px-5 lg:order-none lg:mx-0 lg:basis-auto lg:overflow-visible lg:px-0 lg:pb-0"
              : "hidden lg:block",
            "lg:ml-4",
          )}
        >
          <ul className="flex gap-1">
            {nav.map((link) => {
              const state = current(link.href);
              return (
                <li key={link.href} className="flex shrink-0">
                  <Link
                    href={link.href}
                    prefetch={false}
                    aria-current={state}
                    className={cn(TOP_BAR_PILL, state ? "bg-action-surface font-semibold text-primary-text" : "text-primary-text hover:bg-action-surface")}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 py-2.5 sm:gap-2">
          {search ? <div className="flex min-w-0 justify-end lg:w-72 xl:w-80">{search}</div> : null}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">{actions}</div>
        </div>
      </div>
    </header>
  );
}
