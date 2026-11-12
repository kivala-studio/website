"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { cn } from "../cn";
import { Icon, type IconName } from "../icons/icon";

export type MenuEntry =
  | { kind: "item"; label: string; icon?: IconName; onSelect: () => void; destructive?: boolean; disabled?: boolean; testID?: string }
  | { kind: "check"; label: string; checked: boolean; onToggle: () => void }
  | { kind: "heading"; label: string }
  | { kind: "separator" };

const ENTRY =
  "flex min-h-11 w-full items-center gap-3 rounded-small px-3 text-left text-body text-primary-text outline-none focus-visible:bg-elevated-background hover:bg-elevated-background aria-disabled:opacity-42";

/**
 * A menu button (WAI-ARIA menu): Enter, Space or the arrows open it on the first or last item; arrows, Home
 * and End move; Escape closes it and returns focus; a click outside or Tab closes it. Replaces swipe and
 * long-press actions on the web.
 */
export function Menu({
  label,
  icon = "more",
  entries,
  trigger,
  align = "end",
  testID,
}: {
  /** The trigger's accessible name. */
  label: string;
  icon?: IconName;
  entries: readonly MenuEntry[];
  /** Visible trigger content; an icon button without it. */
  trigger?: ReactNode;
  align?: "start" | "end";
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  const items = () => [...(list.current?.querySelectorAll<HTMLElement>("[role^=menuitem]:not([aria-disabled=true])") ?? [])];
  const focusAt = (index: number) => {
    const all = items();
    all[(index + all.length) % all.length]?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!list.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const show = (at: "first" | "last") => {
    setOpen(true);
    requestAnimationFrame(() => focusAt(at === "first" ? 0 : -1));
  };

  const dismiss = () => {
    setOpen(false);
    button.current?.focus();
  };

  const onMenuKey = (event: KeyboardEvent) => {
    const all = items();
    const index = all.indexOf(document.activeElement as HTMLElement);
    const moves: Record<string, number | undefined> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: -1 };
    if (event.key in moves) {
      event.preventDefault();
      focusAt(moves[event.key]!);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    } else if (event.key === "Tab") setOpen(false);
  };

  const run = (action: () => void) => {
    dismiss();
    action();
  };

  return (
    <div className="relative inline-flex shrink-0">
      <button
        ref={button}
        type="button"
        aria-label={trigger ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        title={trigger ? undefined : label}
        data-testid={testID}
        onClick={() => (open ? setOpen(false) : show("first"))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            show("first");
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            show("last");
          }
        }}
        className={cn(
          "motion-press inline-flex min-h-11 items-center justify-center rounded-full text-primary-text",
          trigger ? "gap-2 bg-action-surface px-4 text-secondary font-semibold" : "size-11 text-secondary-text hover:text-primary-text",
        )}
      >
        {trigger ?? <Icon name={icon} />}
      </button>
      {open ? (
        <div
          ref={list}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className={cn(
            "panel absolute top-full z-40 mt-1 flex max-h-[min(24rem,70dvh)] min-w-60 flex-col overflow-y-auto bg-card-background p-1",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {entries.map((entry, index) => {
            switch (entry.kind) {
              case "separator":
                return <div key={index} role="separator" className="my-1 h-px bg-hairline" />;
              case "heading":
                return (
                  <div key={index} role="presentation" className="px-3 pt-2 pb-1 text-caption font-semibold text-secondary-text">
                    {entry.label}
                  </div>
                );
              case "check":
                return (
                  <button
                    key={index}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={entry.checked}
                    tabIndex={-1}
                    onClick={() => run(entry.onToggle)}
                    className={ENTRY}
                  >
                    <Icon name="check" className={entry.checked ? "text-accent" : "invisible"} />
                    <span className="truncate">{entry.label}</span>
                  </button>
                );
              default:
                return (
                  <button
                    key={index}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    aria-disabled={entry.disabled || undefined}
                    data-testid={entry.testID}
                    onClick={() => !entry.disabled && run(entry.onSelect)}
                    className={cn(ENTRY, entry.destructive && "text-negative")}
                  >
                    {entry.icon ? <Icon name={entry.icon} /> : <span aria-hidden className="w-6" />}
                    <span className="truncate">{entry.label}</span>
                  </button>
                );
            }
          })}
        </div>
      ) : null}
    </div>
  );
}

/** An on/off switch with its visible label; the whole row is the target. */
export function SwitchRow({
  label,
  checked,
  onChange,
  disabled,
  testID,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  testID?: string;
  /** Extra content under the label (a value line). */
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      data-testid={testID}
      className="flex min-h-11 w-full items-center gap-3 rounded-small py-2 text-left disabled:opacity-42"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body text-primary-text">{label}</span>
        {children}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 motion-reduce:transition-none",
          checked ? "bg-positive" : "bg-elevated-background ring-1 ring-hairline",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
