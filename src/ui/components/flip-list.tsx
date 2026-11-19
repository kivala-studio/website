"use client";

import { Component, createRef, type HTMLAttributes, type ReactNode } from "react";

import { boxOf, type Delta, deltaBetween, isNegligible } from "../motion/glide";
import { motionDuration, motionEasing, prefersReducedMotion } from "../motion/tokens";

type Props = HTMLAttributes<HTMLElement> & {
  /** The list element (default `ul`); `tbody` for table rows. */
  as?: "ul" | "ol" | "tbody" | "div";
  children: ReactNode;
};
type Snapshot = Map<string, DOMRect> | null;

/** More moving items than this and the list just changes: a full reshuffle reads better as one swap. */
const MAX_MOVING = 60;

/**
 * A list whose items glide to their new places when the order changes (a sort, a reorder, an item added or removed
 * above them) and whose new items fade in. Mark every item with a stable `data-flip-key`. Positions are read just
 * before React changes the list and just after (FLIP), so a change mid-glide starts from where each item is. Removed
 * items leave at once; the rest close the gap. Nothing plays on the first render or with reduced motion.
 */
export class FlipList extends Component<Props> {
  private root = createRef<HTMLElement>();
  private playing = new Map<Element, Animation>();

  private items(): HTMLElement[] {
    const root = this.root.current;
    return root ? [...root.querySelectorAll<HTMLElement>(":scope > [data-flip-key]")] : [];
  }

  getSnapshotBeforeUpdate(): Snapshot {
    if (prefersReducedMotion()) return null;
    // Where each item is on screen now, mid-glide included.
    return new Map(this.items().map((item) => [item.dataset.flipKey!, item.getBoundingClientRect()]));
  }

  componentDidUpdate(_props: Props, _state: unknown, before: Snapshot) {
    if (!before) return;
    for (const animation of this.playing.values()) animation.cancel();
    this.playing.clear();
    const items = this.items();
    const moves = items.flatMap((item): { item: HTMLElement; delta: Delta | null }[] => {
      const from = before.get(item.dataset.flipKey!);
      if (!from) return [{ item, delta: null }];
      const delta = deltaBetween(from, boxOf(item));
      return isNegligible(delta) ? [] : [{ item, delta }];
    });
    if (!moves.length || moves.length > MAX_MOVING) return;
    const options = { duration: motionDuration("base"), easing: motionEasing("emphasized") };
    for (const { item, delta } of moves) {
      const keyframes = delta
        ? [{ transform: `translate(${delta.dx}px, ${delta.dy}px)` }, { transform: "none" }]
        : [{ opacity: 0, transform: "translateY(0.25rem)" }, { opacity: 1, transform: "none" }];
      this.playing.set(item, item.animate(keyframes, options));
    }
  }

  componentWillUnmount() {
    for (const animation of this.playing.values()) animation.cancel();
  }

  render() {
    const { as: List = "ul", children, ...props } = this.props;
    return (
      <List ref={this.root as never} {...props}>
        {children}
      </List>
    );
  }
}
