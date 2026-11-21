"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useId, useRef } from "react";

import { cn } from "../cn";
import { IconButton } from "./buttons";

/**
 * Modal built on <dialog>: focus is trapped, Escape closes, focus returns to the opener. Opening focuses
 * the first control, or a descendant marked `data-autofocus`.
 * `sheet` is a side panel on wide screens and a bottom sheet on phones (iOS sheets), sliding in from its edge;
 * `dialog` is a centred window that rises and grows in. Both leave the same way where the browser keeps a closing
 * dialog on top (`motion-sheet`, `motion-modal`), and the page is usable again the moment they close. Keep the
 * component mounted and drive `open`, or the exit has nothing to play on. `instant` skips the motion both ways
 * while it is set (a dialog opened or closed from the keyboard).
 */
export function Dialog({
  open,
  onClose,
  title,
  variant = "sheet",
  instant = false,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  variant?: "sheet" | "dialog";
  /** Appear and leave at once, backdrop included; read when `open` changes. */
  instant?: boolean;
  children: ReactNode;
  /** Persistent bottom area for the primary action. */
  footer?: ReactNode;
}) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // `showModal` focuses the first control (Close); a field that asked for focus keeps it.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Gone for assistive technology and the pointer the moment it closes, while it plays its exit.
      aria-hidden={!open || undefined}
      inert={!open || undefined}
      data-instant={instant || undefined}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        // `fixed` keeps the closing dialog where it was while it leaves (it is no longer `:modal` then).
        "fixed m-0 max-h-none max-w-none flex-col border-card-border bg-card-background p-0 text-primary-text shadow-panel backdrop:bg-black/40 open:flex",
        variant === "dialog"
          ? "motion-modal inset-0 m-auto max-h-[85dvh] w-[min(32rem,calc(100%-2rem))] rounded-card border"
          : "motion-sheet inset-x-0 top-auto bottom-0 max-h-[92dvh] w-full rounded-t-card border-t md:inset-y-0 md:right-0 md:left-auto md:h-dvh md:max-h-none md:w-[28rem] md:rounded-none md:rounded-l-card md:border-t-0 md:border-l",
      )}
    >
      {/* The close button comes first in the DOM (the control `showModal` focuses) and sits at the end of the row. */}
      <header className="flex min-h-11 items-center gap-3 pt-4 pr-3 pl-5 desk:pt-5 desk:pr-4 desk:pl-6">
        <IconButton icon="close" label={t("close")} onClick={onClose} variant="plain" className="order-last -my-1 text-secondary-text" />
        <h2 id={titleId} className="min-w-0 flex-1 text-section text-primary-text">
          {title}
        </h2>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4 desk:px-6 desk:pb-6">{children}</div>
      {footer ? <div className="border-t border-hairline px-5 py-4 desk:px-6">{footer}</div> : null}
    </dialog>
  );
}
