import type { ReactNode } from "react";

import { cn } from "@/ui/cn";
import { PAGE_CONTAINER } from "@/ui/components/layout";
import { Icon, type IconName } from "@/ui/icons/icon";

import { PalancaMark } from "./chrome";

/*
 * Landing page building blocks: a centred hero on a glow and grid with its coverage figures and the market showcase,
 * centred section headings, alternating feature rows and a closing band. Server components only.
 */

/** Section spacing on the canvas. */
export const HOME_SECTION = cn(PAGE_CONTAINER, "py-16 md:py-24");

/** Large section heading in the display face (CoinStats' 40 px section titles on desk). */
export const HOME_HEADING = "text-display text-primary-text text-balance lg:text-[2.5rem] lg:leading-[1.15] lg:tracking-[-0.02em]";

/** The hero title: fluid from 36 px on phones to 68 px on wide screens, tracking −0.02em (−0.025em from 640 px). */
export const HERO_TITLE =
  "font-display text-[clamp(2.25rem,1.2rem+4.4vw,4.25rem)] leading-[1.04] font-semibold tracking-[-0.02em] sm:tracking-[-0.025em] text-balance text-primary-text";

/**
 * The hero backdrop: an accent glow from the top over a fine grid that fades out towards the edges. Decorative; place
 * it first inside a `relative isolate overflow-hidden` block.
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="hero-grid absolute inset-0" />
      <div className="hero-glow absolute inset-x-0 top-0 h-[26rem] sm:h-[40rem]" />
    </div>
  );
}

/** Coverage figures under the hero actions: each count in the display face beside its label. */
export function HeroFigures({ items }: { items: { value: string; label: string }[] }) {
  return (
    <dl className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1.5 sm:gap-x-8">
      {items.map((item) => (
        <div key={item.label} className="flex flex-row-reverse items-baseline gap-1.5">
          <dt className="text-caption text-secondary-text sm:text-secondary">{item.label}</dt>
          <dd className="font-display text-secondary font-semibold text-primary-text sm:text-body">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The product showcase under the hero: a translucent bezel around the product (from 640 px), on an accent halo. The halo is
 * decorative; the content is the product.
 */
export function Showcase({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div
        aria-hidden
        className="showcase-halo pointer-events-none absolute -inset-x-[15%] -top-32 -z-10 h-[34rem] sm:-inset-x-[18%]"
      />
      <div className="sm:rounded-[calc(var(--radius-card)+0.5rem)] sm:border sm:border-card-border sm:bg-[color-mix(in_srgb,var(--card-background)_45%,transparent)] sm:p-2 sm:backdrop-blur-md">
        {children}
      </div>
    </div>
  );
}

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
