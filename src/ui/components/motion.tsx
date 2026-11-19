import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../cn";
import { Icon, type IconName } from "../icons/icon";

/*
 * Motion building blocks that need no script: server components can use them. The behaviour is CSS in
 * `src/ui/theme/motion.css`; see docs/design/theme.md#motion.
 */

/**
 * Two icons in one place, the other one shrinking away while the shown one grows in (menu ↔ close, eye ↔ eye-off,
 * star ↔ filled star). `turn` adds a quarter turn. Decorative: the control around it carries the name and state.
 */
export function IconSwap({
  icons,
  show,
  turn = false,
  scale,
  className,
}: {
  icons: readonly [IconName, IconName];
  /** Which icon shows: the first or the second. */
  show: 0 | 1;
  turn?: boolean;
  scale?: "s" | "m" | "l";
  className?: string;
}) {
  return (
    <span aria-hidden data-swap={show === 0 ? "a" : "b"} data-turn={turn || undefined} className={cn("motion-swap", className)}>
      <Icon name={icons[0]} scale={scale} />
      <Icon name={icons[1]} scale={scale} />
    </span>
  );
}

/**
 * A region that folds open and closed, its height following its content (accordions, expandable rows, "show more").
 * Closed, it takes no space and its content is inert and hidden from assistive technology once folded. Pair it with
 * a button that has `aria-expanded` and `aria-controls={id}`. For a native `<details>`, use `motion-details` instead.
 */
export function Collapse({
  open,
  children,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "children"> & { open: boolean; children: ReactNode }) {
  return (
    <div {...props} data-state={open ? "open" : "closed"} inert={!open || undefined} className="motion-collapse">
      <div className={className}>{children}</div>
    </div>
  );
}
