import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { PAGE_CONTAINER } from "@/ui/components/layout";
import { Icon, type IconName } from "@/ui/icons/icon";

import { PalancaMark } from "./chrome";

/*
 * Landing page building blocks (the CoinStats landing structure): a centred hero on faint rings, entry tiles,
 * centred section headings, alternating feature rows and a closing band. Server components only.
 */

/** Section spacing on the canvas. */
export const HOME_SECTION = cn(PAGE_CONTAINER, "py-16 md:py-24");

/** Large section heading in the display face (CoinStats' 40 px section titles on desk). */
export const HOME_HEADING = "text-display text-primary-text text-balance lg:text-[2.5rem] lg:leading-[1.15] lg:tracking-[-0.02em]";

/** Faint concentric rings and a soft accent glow behind the hero. Decorative. */
export function HeroRings() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 flex justify-center overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
      <div className="relative aspect-square w-[64rem] max-w-none shrink-0 -translate-y-[18%]">
        <div className="absolute inset-[22%] rounded-full bg-[radial-gradient(closest-side,var(--accent-soft),transparent)] opacity-80" />
        <svg viewBox="0 0 200 200" className="absolute inset-0 size-full fill-none stroke-hairline" focusable="false">
          <circle cx="100" cy="100" r="44" strokeWidth="0.25" />
          <circle cx="100" cy="100" r="62" strokeWidth="0.25" strokeDasharray="0.6 1.4" />
          <circle cx="100" cy="100" r="80" strokeWidth="0.25" />
          <circle cx="100" cy="100" r="98" strokeWidth="0.25" strokeDasharray="0.6 1.4" />
        </svg>
      </div>
    </div>
  );
}

/** A square entry tile: icon on a soft accent disc, the label and a "Ver tudo →" cue. The whole tile is the link; size it with `ENTRY_TILE_ITEM`. */
export function EntryTile({ href, icon, title, cue }: { href: { pathname: string; query: Record<string, string> }; icon: IconName; title: string; cue: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="panel motion-press flex min-h-32 w-full flex-col items-center justify-center gap-2 p-3 sm:aspect-square text-center transition-colors hover:border-field-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="mb-1 flex size-14 items-center justify-center rounded-full bg-accent-soft text-[1.625rem] text-accent">
        <Icon name={icon} />
      </span>
      <span className="font-display text-secondary font-medium text-primary-text">{title}</span>
      <span className="inline-flex items-center gap-1 font-display text-caption font-semibold text-primary-text">
        {cue}
        <Icon name="arrow-right" scale="s" />
      </span>
    </Link>
  );
}

/** The list item around an entry tile: two per row on phones, a fixed square from 640 px. */
export const ENTRY_TILE_ITEM = "w-[calc(50%-0.375rem)] sm:w-34 lg:w-36";

/** One fact in the "all in one" list: icon disc, bold title, one short line. */
export function FactItem({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-2">
      <h3 className="flex items-center gap-3 font-display text-section text-primary-text">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon name={icon} />
        </span>
        {title}
      </h3>
      <p className="max-w-sm text-body text-secondary-text">{children}</p>
    </li>
  );
}

const NODES: { icon: IconName; position: string }[] = [
  { icon: "trend-up", position: "left-[6%] top-[12%]" },
  { icon: "bond", position: "left-[6%] bottom-[12%]" },
  { icon: "dividend", position: "right-[6%] top-[12%]" },
  { icon: "shield-check", position: "right-[6%] bottom-[12%]" },
];

/**
 * The "all in one" diagram: the four kinds of instrument wired into one portfolio ring with the palanca at its centre.
 * Decorative; the list beside it says the same in words.
 */
export function HubDiagram({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("@container relative mx-auto aspect-[4/3] w-full max-w-[32rem]", className)}>
      <svg viewBox="0 0 400 300" className="absolute inset-0 size-full fill-none stroke-hairline" focusable="false">
        {/* Circuit lines from each node to the ring. */}
        <path d="M58 64 H120 Q140 64 140 84 V120 Q140 140 160 140" strokeWidth="2" />
        <path d="M58 236 H120 Q140 236 140 216 V180 Q140 160 160 160" strokeWidth="2" />
        <path d="M342 64 H280 Q260 64 260 84 V120 Q260 140 240 140" strokeWidth="2" />
        <path d="M342 236 H280 Q260 236 260 216 V180 Q260 160 240 160" strokeWidth="2" />
        {/* Allocation ring: four arcs. */}
        <g transform="rotate(-90 200 150)" strokeWidth="18">
          <circle cx="200" cy="150" r="52" className="stroke-accent" strokeDasharray="130 197" />
          <circle cx="200" cy="150" r="52" className="stroke-accent/55" strokeDasharray="0 132 82 113" />
          <circle cx="200" cy="150" r="52" className="stroke-accent/30" strokeDasharray="0 216 56 55" />
          <circle cx="200" cy="150" r="52" className="stroke-accent-soft" strokeDasharray="0 274 51 2" />
        </g>
      </svg>
      <span className="absolute top-1/2 left-1/2 flex size-[16%] -translate-x-1/2 -translate-y-1/2 items-center justify-center text-primary-text">
        <PalancaMark className="size-full" />
      </span>
      {NODES.map((node) => (
        <span
          key={node.icon}
          className={cn(
            "panel absolute flex size-[14%] items-center justify-center rounded-[28%] text-[7cqw] text-accent",
            node.position,
          )}
        >
          <Icon name={node.icon} />
        </span>
      ))}
    </div>
  );
}

/**
 * A feature row: the product visual (a piece of the web product on a soft stage) on one side; icon, heading, message and a pill on the other.
 * `flip` puts the visual on the right from 768 px.
 */
export function FeatureRow({
  id,
  icon,
  title,
  message,
  action,
  visual,
  flip = false,
}: {
  id: string;
  icon: IconName;
  title: string;
  message: string;
  action: ReactNode;
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <section aria-labelledby={id} className={cn(PAGE_CONTAINER, "grid items-center gap-8 py-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-16 md:py-16")}>
      <div className={cn("flex min-w-0 justify-center", flip && "md:order-2")}>{visual}</div>
      <div className="flex max-w-md flex-col items-start gap-4">
        <Icon name={icon} className="text-[2rem] text-accent" />
        <h2 id={id} className={HOME_HEADING}>
          {title}
        </h2>
        <p className="text-body text-secondary-text">{message}</p>
        <div className="mt-2 w-full sm:w-auto">{action}</div>
      </div>
    </section>
  );
}
