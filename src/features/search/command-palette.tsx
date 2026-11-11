"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { usePathname } from "@/i18n/navigation";

import type { CatalogueRow } from "@/features/market/browse/price-cell";
import { Dialog } from "@/ui/components/dialog";
import { Icon } from "@/ui/icons/icon";

import { SearchPanel } from "./search-panel";

/** Typing in a field, or a key with a modifier the shortcut does not use, keeps the key for the page. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Search from anywhere in the app: `/` or Ctrl/⌘ K opens the search panel in a dialog, and the next page
 * closes it. The header button is the pointer way in on wide screens (phones have the Pesquisa tab).
 */
export function CommandPalette({ rows, renderedAt }: { rows: readonly CatalogueRow[]; renderedAt: number }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
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
        className="hidden min-h-11 items-center gap-2 rounded-full bg-action-surface px-4 text-secondary text-secondary-text lg:inline-flex"
        data-testid="search-palette-button"
      >
        <Icon name="search" />
        <span>{t("common.search")}</span>
        <kbd aria-hidden className="rounded-small border border-separator px-1.5 text-micro">
          /
        </kbd>
      </button>
      <Dialog variant="dialog" open={open} onClose={() => setOpen(false)} title={t("common.search")}>
        {open ? <SearchPanel rows={rows} renderedAt={renderedAt} autoFocus /> : null}
      </Dialog>
    </>
  );
}
