"use client";

import { useTranslations } from "next-intl";
import { createContext, type MouseEvent, type ReactNode, use, useEffect, useState } from "react";

import { useDestinationPathname, usePathname } from "@/i18n/navigation";

import type { CatalogueRow } from "@/features/market/browse/price-cell";
import { cn } from "@/ui/cn";
import { TOP_BAR_FLOAT } from "@/ui/components/button-styles";
import { iconButtonClass } from "@/ui/components/buttons";
import { FIELD, KeyHint } from "@/ui/components/controls";
import { Dialog } from "@/ui/components/dialog";
import { Icon } from "@/ui/icons/icon";
import { usePresence } from "@/ui/motion/use-presence";

import { SearchPanel } from "./search-panel";

/** Typing in a field, or a key with a modifier the shortcut does not use, keeps the key for the page. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Search from anywhere in the app: `/` or Ctrl/⌘ K opens the search panel in a dialog, and the next page
 * closes it. Its triggers sit anywhere inside it: the sidebar's search field (with the `/` hint) from 1024 px, the
 * top bar's search button below. One palette serves both, so the shortcut opens one dialog.
 * The motion follows the input: opened from the keyboard (the shortcut, or the button pressed with Enter or Space) the
 * dialog is there at once, and closed with Escape or by following a result with Enter it is gone at once; a click or
 * a tap keeps the rise and the fade.
 */
export function CommandPalette({ rows, renderedAt, children }: { rows: readonly CatalogueRow[]; renderedAt: number; children: ReactNode }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  // The panel stays while the dialog leaves, then unmounts: each opening starts with an empty search.
  const { mounted } = usePresence(open);
  const pathname = usePathname();
  const destination = useDestinationPathname();
  // Following a result closes the palette at once, over the next page's skeleton. The panel (and the pressed link,
  // whose navigation it is) stays mounted in the closed dialog until the page is there.
  const [openedOn, setOpenedOn] = useState(pathname);
  const [following, setFollowing] = useState(false);
  if (open && destination !== openedOn) {
    setOpen(false);
    setFollowing(true);
  }
  if (following && !open && destination === pathname) setFollowing(false);
  const [instant, setInstant] = useState(false);
  const show = (fromKeyboard: boolean) => {
    setOpenedOn(pathname);
    setInstant(fromKeyboard);
    setOpen(true);
  };
  // A click from a key press has no pointer position (`detail` 0).
  const onButton = (event: MouseEvent<HTMLButtonElement>) => show(event.detail === 0);

  // While open, the last input decides how it closes. Capture, so the dialog's own handling of a key comes after.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") setInstant(true);
    };
    const onPointer = () => setInstant(false);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const shortcut = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping(event.target);
      if (!shortcut && !slash) return;
      event.preventDefault();
      show(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <OpenSearch value={onButton}>
      {children}
      <Dialog variant="dialog" open={open} instant={instant} onClose={() => setOpen(false)} title={t("common.search")}>
        {mounted || following ? <SearchPanel rows={rows} renderedAt={renderedAt} autoFocus /> : null}
      </Dialog>
    </OpenSearch>
  );
}

/** Opens the palette from a trigger; a click from a key press has no pointer position (`detail` 0). */
const OpenSearch = createContext<(event: MouseEvent<HTMLButtonElement>) => void>(() => {});

const SEARCH_TRIGGER = { type: "button", "aria-keyshortcuts": "/ Control+K Meta+K", "aria-haspopup": "dialog" } as const;

/** The palette's trigger drawn as the search field, with the `/` hint. */
export function SearchField({ className }: { className?: string }) {
  const t = useTranslations();
  const open = use(OpenSearch);
  return (
    <button
      {...SEARCH_TRIGGER}
      onClick={open}
      // Looks like the search field, so it takes the field's focus (accent border and glow) instead of the outline.
      className={cn(FIELD, "flex w-full hover:border-control-outline focus-visible:border-accent focus-visible:shadow-focus focus-visible:outline-none", className)}
      data-testid="search-palette-button"
    >
      <Icon name="search" />
      <span className="flex-1 truncate text-left text-secondary">{t("common.search")}</span>
      <KeyHint>/</KeyHint>
    </button>
  );
}

/** The palette's trigger as a round search button. */
export function SearchButton({ className }: { className?: string }) {
  const t = useTranslations();
  const open = use(OpenSearch);
  return (
    <button {...SEARCH_TRIGGER} onClick={open} aria-label={t("common.search")} title={t("common.search")} className={iconButtonClass("surface", cn(TOP_BAR_FLOAT, className))}>
      <Icon name="search" scale="l" />
    </button>
  );
}
