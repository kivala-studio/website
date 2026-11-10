"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useId, useRef } from "react";

import { cn } from "../cn";
import { IconButton } from "./buttons";

/**
 * Modal built on <dialog>: focus is trapped, Escape closes, focus returns to the opener.
 * `sheet` is a side panel on wide screens and a bottom sheet on phones (iOS sheets);
 * `dialog` is a centred window.
 */
export function Dialog({
  open,
  onClose,
  title,
  variant = "sheet",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  variant?: "sheet" | "dialog";
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
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 max-h-none max-w-none bg-app-background p-0 text-primary-text backdrop:bg-black/40 open:flex open:flex-col",
        variant === "dialog"
          ? "inset-0 m-auto max-h-[85dvh] w-[min(32rem,calc(100%-2rem))] rounded-large"
          : "inset-x-0 top-auto bottom-0 max-h-[92dvh] w-full rounded-t-large md:inset-y-0 md:right-0 md:left-auto md:h-dvh md:max-h-none md:w-[28rem] md:rounded-none md:rounded-l-large",
        "motion-presence",
      )}
    >
      <header className="flex items-center gap-3 px-4 pt-4">
        <IconButton icon="close" label={t("close")} onClick={onClose} />
        <h2 id={titleId} className="text-section text-primary-text">
          {title}
        </h2>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer ? <div className="border-t border-separator px-5 py-4">{footer}</div> : null}
    </dialog>
  );
}
