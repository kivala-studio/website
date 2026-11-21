"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { Link, usePathname } from "@/i18n/navigation";

import { cn } from "../cn";
import { useSlidingIndicator } from "../motion/use-sliding-indicator";
import { INDICATOR_FILL, INDICATOR_IDLE, iconButtonClass, TOP_BAR_FLOAT } from "./button-styles";
import { useLinkCurrent } from "./controls";
import { PAGE_CONTAINER } from "./layout";
import { IconSwap } from "./motion";

export type TopBarLink = { href: string; label: string };

/** A link of the top bar's capsule: plain text; the current section sits on the soft accent fill, which glides to the next section. */
export const TOP_BAR_PILL = "motion-press inline-flex min-h-11 shrink-0 items-center rounded-full px-4 font-display text-secondary font-medium whitespace-nowrap";
const TOP_BAR_PILL_CURRENT = cn(INDICATOR_FILL, "font-semibold text-primary-text before:bg-accent-soft");

/** A link row of the top bar's menu: the pill's look at row size. */
const MENU_ROW = "motion-tap flex min-h-12 items-center rounded-full px-4 font-display text-section";

type MobileNav =
  /** Below 1024 px the navigation is left to the bottom tab bar (the app). */
  | { mobileNav: "none"; menu?: never; wideActions?: never }
  /**
   * Below 1024 px the navigation and `menu.content` (the theme, the language) move into a menu behind a round button
   * at the end of the bar, after the actions (the public site). `wideActions` show only from 1024 px, before `actions`.
   */
  | { mobileNav: "menu"; menu: { label: string; content: ReactNode }; wideActions?: ReactNode };

/**
 * The one top bar of the site and the app: not a strip but three opaque pieces floating over the canvas, sticky at
 * the top with no background of their own, so the page passes under them. The logo on the left (it gains the card
 * fill once the page scrolls under it), the navigation in a centred capsule on the card fill, then the search and the
 * actions on the right; the row sits in `PAGE_CONTAINER`, on the page's edges. Below 1024 px the navigation either
 * moves into a menu whose round button ends the bar (`mobileNav="menu"`, the public site) or is left to the bottom
 * tab bar (`"none"`, the app). Actions bring their own opaque fill (`iconButtonClass("surface")`, a pill).
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
    // The bar itself takes no clicks: only its pieces do, so the page under the gaps stays usable.
    <header className="pointer-events-none sticky top-0 z-30">
      {/* The row sits in the page column, so the logo and the last action line up with the content below. From 1024 px
          the capsule is centred on the page while both sides fit, and gives way to them when they don't. */}
      <div
        className={cn(
          PAGE_CONTAINER,
          "flex h-(--top-bar-height) items-center gap-2 lg:grid lg:grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] lg:gap-4",
        )}
      >
        <Link
          href={home.href}
          prefetch={false}
          aria-label={home.label}
          className="top-bar-backing pointer-events-auto -ml-3 inline-flex min-h-12 shrink-0 items-center gap-2 justify-self-start rounded-full bg-card-background px-3 text-primary-text lg:min-h-14 lg:pr-4"
        >
          {logo}
        </Link>
        <nav aria-label={navLabel} className="pointer-events-auto hidden lg:block">
          <ul ref={pills} className={cn(TOP_BAR_FLOAT, "flex gap-1 rounded-full bg-card-background p-1.5")}>
            {nav.map((link) => {
              const state = current(link.href);
              return (
                <li key={link.href} className="flex shrink-0">
                  <Link
                    href={link.href}
                    prefetch={false}
                    aria-current={state}
                    className={cn(TOP_BAR_PILL, state ? TOP_BAR_PILL_CURRENT : cn(INDICATOR_IDLE, "text-primary-text hover:bg-accent-soft/60"))}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex min-w-0 items-center justify-end gap-2 justify-self-end *:pointer-events-auto lg:ml-0">
          {search ? <div className="flex min-w-0 justify-end lg:w-56 xl:w-72">{search}</div> : null}
          {wideActions ? <div className="hidden lg:contents">{wideActions}</div> : null}
          {actions}
          {mobileNav === "menu" ? <TopBarMenu label={menu.label} nav={nav} navLabel={navLabel} content={menu.content} /> : null}
        </div>
      </div>
    </header>
  );
}

/** Where the menu gives way to the bar's own navigation (`lg:`). */
const WIDE = "(min-width: 64rem)";

/**
 * The menu button and its panel, below 1024 px: a disclosure (not a WAI-ARIA menu: it holds links and a segmented
 * control). The round button ends the bar, and the panel follows it in the DOM, so Tab goes from the button into the
 * panel. The panel is a card that drops from under the bar, in the page column, over a dimmed page (the bar's pieces
 * stay above the dim) that doesn't scroll. Escape or a tap on the dimmed page closes it and returns focus to the button;
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
        className={iconButtonClass("surface", cn(TOP_BAR_FLOAT, "lg:hidden"))}
      >
        <IconSwap icons={["menu", "close"]} show={open ? 1 : 0} turn scale="l" />
      </button>
      {phase === "closed" ? null : (
        <>
          {/* The dimmed page, behind the bar's pieces (the bar is its own stacking context). Not focusable; a tap closes. */}
          <div
            aria-hidden
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => close(true)}
            className={cn("absolute inset-x-0 top-0 -z-10 h-dvh bg-black/40 lg:hidden", open ? "motion-dim-in" : "motion-dim-out")}
          />
          <div className={cn(PAGE_CONTAINER, "absolute inset-x-0 top-full lg:hidden")}>
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
                "max-h-[calc(100dvh-var(--top-bar-height)-1rem)] overflow-y-auto overscroll-contain rounded-card bg-card-background p-3 shadow-panel",
                open ? "motion-drop-in" : "motion-drop-out",
              )}
            >
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
                          className={cn(MENU_ROW, state ? "bg-accent-soft font-semibold text-primary-text" : "font-medium text-primary-text hover:bg-accent-soft/60")}
                        >
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="mt-3 border-t border-hairline px-1 pt-4">{content}</div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
