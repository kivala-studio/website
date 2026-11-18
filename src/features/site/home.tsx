import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { PAGE_CONTAINER } from "@/ui/components/layout";
import { Icon, type IconName } from "@/ui/icons/icon";

import { IllustrativeCaption } from "./visuals";

/*
 * Landing page building blocks: a centred hero on a glow and grid with its coverage figures and the market showcase,
 * centred section headings, the bento, alternating feature rows and a closing band. Server components only.
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

/**
 * The "all in one" bento: product areas the feature rows do not cover, one card each, under one "Exemplo ilustrativo"
 * caption. Six columns from 1024 px, two from 768 px, one on phones.
 */
export function Bento({ children }: { children: ReactNode }) {
  return (
    <figure className="flex flex-col items-center gap-3">
      <ul className="grid w-full grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 lg:grid-cols-6 lg:gap-5">{children}</ul>
      <IllustrativeCaption />
    </figure>
  );
}

/**
 * One bento card, a whole-card link: the title, then the miniature in a frame that bleeds off the bottom edge (and the
 * right one with `bleed="corner"`) under a fade. `wide` spans four of six columns (the whole row at 768 px); `wash` adds
 * the soft accent light. The miniature is decorative: the link's name is the title.
 */
export function BentoCard({
  href,
  title,
  wide = false,
  wash = false,
  bleed = "bottom",
  children,
}: {
  href: string;
  title: string;
  wide?: boolean;
  wash?: boolean;
  bleed?: "bottom" | "corner";
  children: ReactNode;
}) {
  return (
    <li className={cn("flex min-w-0", wide ? "md:col-span-2 lg:col-span-4" : "lg:col-span-2")}>
      <Link
        href={href}
        prefetch={false}
        className="group motion-press flex w-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <div className="panel relative isolate flex w-full flex-col overflow-hidden transition-[border-color,translate] duration-200 ease-out group-hover:border-field-border motion-safe:group-hover:-translate-y-0.5 motion-reduce:transition-none">
          {wash ? <div aria-hidden className="bento-wash absolute inset-0 -z-10" /> : null}
          <h3 className="flex items-center justify-between gap-3 px-5 pt-5 font-display text-section text-primary-text desk:px-6 desk:pt-6">
            {title}
            <Icon name="chevron-right" className="shrink-0 text-[1.125rem] text-tertiary-text transition-[translate,color] duration-200 group-hover:text-primary-text motion-safe:group-hover:translate-x-0.5" />
          </h3>
          <div
            aria-hidden
            className={cn(
              "mt-5 h-56 overflow-hidden select-none mask-b-from-70%",
              bleed === "corner" ? "ml-5 desk:ml-6" : "mx-5 desk:mx-6",
            )}
          >
            <div
              className={cn(
                "flex h-full flex-col rounded-t-[1.125rem] border border-b-0 border-card-border bg-app-background p-2.5 *:grow",
                bleed === "corner" && "rounded-tr-none border-r-0 pr-0 *:rounded-r-none *:border-r-0",
              )}
            >
              {children}
            </div>
          </div>
        </div>
      </Link>
    </li>
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
