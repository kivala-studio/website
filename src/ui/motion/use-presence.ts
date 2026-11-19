"use client";

import { type AnimationEvent, type TransitionEvent, useCallback, useEffect, useState } from "react";

export type PresenceState = "open" | "closing" | "closed";

/**
 * Keeps something on screen while it leaves. `open` is what the component wants; the presence is `open`, then
 * `closing` while the exit plays, then `closed` (unmount). Spread `presenceProps` on the element that animates: its
 * `data-state` drives the CSS (`motion-pop`, or any `data-[state=closing]:` classes) and its own transition or
 * animation ending finishes the exit. A timer finishes it too, for a browser or a reduced-motion setting that plays
 * nothing. Opening again mid-exit turns the element back without remounting it.
 *
 * While closing, the element is `inert` and hidden from assistive technology: it is already gone for everyone.
 */
export function usePresence(open: boolean, { timeout = 400 }: { timeout?: number } = {}) {
  const [state, setState] = useState<PresenceState>(open ? "open" : "closed");
  if (open && state !== "open") setState("open");
  if (!open && state === "open") setState("closing");

  const finish = useCallback(() => setState((now) => (now === "closing" ? "closed" : now)), []);

  useEffect(() => {
    if (state !== "closing") return;
    const timer = window.setTimeout(finish, timeout);
    return () => window.clearTimeout(timer);
  }, [state, finish, timeout]);

  const onEnd = (event: AnimationEvent | TransitionEvent) => {
    if (event.target === event.currentTarget) finish();
  };

  return {
    /** Render the element while this is true. */
    mounted: state !== "closed",
    state,
    presenceProps: {
      "data-state": state,
      inert: state === "closing" || undefined,
      "aria-hidden": state === "closing" || undefined,
      onTransitionEnd: onEnd,
      onAnimationEnd: onEnd,
    },
  };
}

/**
 * For a dialog or panel that shows a value while there is one (the tile whose details are open, the record being
 * edited, `true` for a plain flag): keeps the last value for the length of the exit, so the dialog can be rendered
 * with `open={false}` and leave with its content, then unmounts it, so nothing it loads or listens to runs while it
 * is closed. `key` changes on every opening: key the dialog with it and each opening starts fresh, as a remount did.
 *
 * ```tsx
 * const details = usePresenceValue(selected);
 * {details.value ? <Details key={details.key} open={details.open} tile={details.value} onClose={…} /> : null}
 * ```
 */
export function usePresenceValue<T>(value: T | null | undefined | false, { timeout = 400 }: { timeout?: number } = {}) {
  const open = value !== null && value !== undefined && value !== false;
  const { mounted } = usePresence(open, { timeout });
  const [kept, setKept] = useState<{ value: T | null; key: number; open: boolean }>(() => ({ value: open ? (value as T) : null, key: 0, open }));
  if (open && (!kept.open || kept.value !== value)) setKept({ value: value as T, key: kept.open ? kept.key : kept.key + 1, open: true });
  if (!open && kept.open) setKept({ ...kept, open: false });
  return { value: mounted ? (open ? (value as T) : kept.value) : null, open, key: kept.key };
}
