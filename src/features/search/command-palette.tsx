"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { usePathname } from "@/i18n/navigation";

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
 * closes it. From 1024 px the top bar shows it as the search field (with the `/` hint); below, as a search button.
 */
export function CommandPalette({ rows, renderedAt }: { rows: readonly CatalogueRow[]; renderedAt: number }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  // The panel stays while the dialog leaves, then unmounts: each opening starts with an empty search.
  const { mounted } = usePresence(open);
  const pathname = usePathname();
  // Following a result closes the palette once the new page is there; unmounting the link first would drop the navigation.
  const [openedOn, setOpenedOn] = useState(pathname);
  if (open && openedOn !== pathname) {
    setOpen(false);
    setOpenedOn(pathname);
  }
  const show = () => {
    setOpenedOn(pathname);
    setOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const shortcut = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping(event.target);
      if (!shortcut && !slash) return;
      event.preventDefault();
      show();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-keyshortcuts="/ Control+K Meta+K"
        aria-haspopup="dialog"
        // Looks like the search field, so it takes the field's focus (accent border and glow) instead of the outline.
        className={cn(FIELD, "hidden w-full hover:border-control-outline focus-visible:border-accent focus-visible:shadow-focus focus-visible:outline-none lg:flex")}
        data-testid="search-palette-button"
      >
        <Icon name="search" />
        <span className="flex-1 truncate text-left text-secondary">{t("common.search")}</span>
        <KeyHint>/</KeyHint>
      </button>
      <button
        type="button"
        onClick={show}
        aria-label={t("common.search")}
        aria-keyshortcuts="/ Control+K Meta+K"
        aria-haspopup="dialog"
        title={t("common.search")}
        className={iconButtonClass("surface", cn(TOP_BAR_FLOAT, "lg:hidden"))}
      >
        <Icon name="search" scale="l" />
      </button>
      <Dialog variant="dialog" open={open} onClose={() => setOpen(false)} title={t("common.search")}>
        {mounted ? <SearchPanel rows={rows} renderedAt={renderedAt} autoFocus /> : null}
      </Dialog>
    </>
  );
}
