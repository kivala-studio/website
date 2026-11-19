"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { Link, usePathname } from "@/i18n/navigation";

import { cn } from "../cn";
import { useSlidingIndicator } from "../motion/use-sliding-indicator";
import { INDICATOR_FILL, INDICATOR_IDLE, iconButtonClass } from "./button-styles";
import { useLinkCurrent } from "./controls";
import { PAGE_CONTAINER } from "./layout";
import { IconSwap } from "./motion";

export type TopBarLink = { href: string; label: string };

/** A pill link of the top bar; the current section has the soft grey pill, which glides to the next section. */
export const TOP_BAR_PILL = "motion-press inline-flex min-h-11 shrink-0 items-center rounded-full px-4 font-display text-secondary font-medium whitespace-nowrap";
const TOP_BAR_PILL_CURRENT = cn(INDICATOR_FILL, "font-semibold text-primary-text before:bg-action-surface");

/** A link row of the top bar's menu: the pill's look at row size. */
const MENU_ROW = "motion-tap flex min-h-12 items-center rounded-full px-4 font-display text-section";

type MobileNav =
  /** Below 1024 px the navigation is left to the bottom tab bar (the app). */
  | { mobileNav: "none"; menu?: never; wideActions?: never }
  /**
   * Below 1024 px the navigation and `menu.content` (the theme, the language) move into a menu behind a button
   * at the start of the bar, before the logo (the public site). `wideActions` show only from 1024 px, before `actions`.
   */
  | { mobileNav: "menu"; menu: { label: string; content: ReactNode }; wideActions?: ReactNode };

/**
 * The one top bar of the site and the app: full width, 64 px, sticky, on the elevated surface with a hairline
 * shadow; its row sits in `PAGE_CONTAINER`, on the page's edges. Logo, pill navigation, then the search and the actions on the right. Below 1024 px the navigation either
 * moves into a menu whose button leads the bar (`mobileNav="menu"`, the public site) or is left to the bottom tab
 * bar (`"none"`, the app).
 */
export function TopBar({
  home,
  logo,
  nav,
  navLabel,
  mobileNav,
  menu,
  wideActions,
  search,
  actions,
}: {
  home: { href: string; label: string };
  logo: ReactNode;
  nav: readonly TopBarLink[];
  navLabel: string;
  search?: ReactNode;
  actions: ReactNode;
} & MobileNav) {
  const current = useLinkCurrent();
  const pathname = usePathname();
  // Remembered by name: route groups with their own layouts render the bar again on a route change.
  const pills = useSlidingIndicator<HTMLUListElement>(pathname, { selector: "[aria-current]", memory: `top-bar:${navLabel}` });
  return (
    <header className="sticky top-0 z-30 bg-elevated-background shadow-bar">
      {/* The row sits in the page column, so the logo and the last action line up with the content below. */}
      <div className={cn(PAGE_CONTAINER, "flex flex-wrap items-center gap-x-1 sm:gap-x-2 lg:flex-nowrap lg:gap-x-3")}>
        {mobileNav === "menu" ? <TopBarMenu label={menu.label} nav={nav} navLabel={navLabel} content={menu.content} /> : null}
        <Link
          href={home.href}
          prefetch={false}
          aria-label={home.label}
          className="-ml-1 inline-flex min-h-16 shrink-0 items-center gap-2 rounded-small px-1 text-primary-text"
        >
          {logo}
        </Link>
        <nav aria-label={navLabel} className="hidden lg:block lg:ml-4">
          <ul ref={pills} className="flex gap-1">
            {nav.map((link) => {
              const state = current(link.href);
              return (
                <li key={link.href} className="flex shrink-0">
                  <Link
                    href={link.href}
                    prefetch={false}
                    aria-current={state}
                    className={cn(TOP_BAR_PILL, state ? TOP_BAR_PILL_CURRENT : cn(INDICATOR_IDLE, "text-primary-text hover:bg-action-surface"))}
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
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            {wideActions ? <div className="hidden lg:contents">{wideActions}</div> : null}
            {actions}
          </div>
        </div>
      </div>
    </header>
  );
}

/** Where the menu gives way to the bar's own navigation (`lg:`). */
const WIDE = "(min-width: 64rem)";

/**
 * The menu button and its panel, below 1024 px: a disclosure (not a WAI-ARIA menu: it holds links and a segmented
 * control). The button leads the bar, its glyph on the gutter (the 48 px target overhangs it), and the panel follows
 * it in the DOM, so Tab goes from the button into the panel. The panel drops from under the bar, full width, over a
 * dimmed page that doesn't scroll. Escape or a tap on the dimmed page closes it and returns focus to the button;
 * following a link, a tap elsewhere on the bar, moving focus out of the menu (to the logo, say) or widening the
 * window past 1024 px closes it too. Without JavaScript the footer still has the same links (not the controls).
 */
function TopBarMenu({ label, nav, navLabel, content }: { label: string; nav: readonly TopBarLink[]; navLabel: string; content: ReactNode }) {
  const current = useLinkCurrent();
  const pathname = usePathname();
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  /** `closing` keeps the panel on screen while it animates out. */
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const open = phase === "open";

  // A new page closes the menu (links inside it, back and forward).
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setPhase("closed");
  }

  const close = (returnFocus = false) => {
    setPhase((now) => (now === "open" ? "closing" : now));
    if (returnFocus) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add("overflow-hidden");
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPhase("closing");
      button.current?.focus();
    };
    const outside = (target: Node) => !panel.current?.contains(target) && !button.current?.contains(target);
    const onPointer = (event: PointerEvent) => {
      if (outside(event.target as Node)) setPhase("closing");
    };
    const onFocus = (event: FocusEvent) => {
      if (outside(event.target as Node)) setPhase("closing");
    };
    const wide = window.matchMedia(WIDE);
    const onWide = () => wide.matches && setPhase("closed");
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocus);
    wide.addEventListener("change", onWide);
    return () => {
      root.classList.remove("overflow-hidden");
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocus);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  // The exit animation (`base`) ends the closing phase; the timer covers a browser that runs no animation.
  useEffect(() => {
    if (phase !== "closing") return;
    const timer = window.setTimeout(() => setPhase("closed"), 400);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={phase === "closed" ? undefined : id}
        onClick={() => (open ? close() : setPhase("open"))}
        className={iconButtonClass("plain", "-ml-4 lg:hidden")}
      >
        <IconSwap icons={["menu", "close"]} show={open ? 1 : 0} turn scale="l" />
      </button>
      {phase === "closed" ? null : (
        <div className="absolute inset-x-0 top-full lg:hidden">
          <div
            ref={panel}
            id={id}
            onClick={(event) => {
              if ((event.target as Element).closest("a")) close();
            }}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && phase === "closing") setPhase("closed");
            }}
            className={cn(
              "max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-hairline bg-elevated-background pt-3 pb-5 shadow-bar",
              open ? "motion-drop-in" : "motion-drop-out",
            )}
          >
            <div className={PAGE_CONTAINER}>
              <nav aria-label={navLabel}>
                <ul className="flex flex-col gap-1">
                  {nav.map((link) => {
                    const state = current(link.href);
                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          prefetch={false}
                          aria-current={state}
                          className={cn(MENU_ROW, state ? "bg-action-surface font-semibold text-primary-text" : "font-medium text-primary-text hover:bg-action-surface")}
                        >
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="mt-3 border-t border-hairline pt-4">{content}</div>
            </div>
          </div>
          {/* The dimmed page: from the panel's edge down, so the bar stays as it is. Not focusable; a tap closes. */}
          <div
            aria-hidden
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => close(true)}
            className={cn("h-dvh bg-black/40", open ? "motion-dim-in" : "motion-dim-out")}
          />
        </div>
      )}
    </>
  );
}
