import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { buttonClass, buttonShape } from "@/ui/components/button-styles";
import { PAGE_CONTAINER } from "@/ui/components/layout";
import { Icon } from "@/ui/icons/icon";

import { PalancaMark } from "./chrome";

/*
 * Landing page building blocks: flat stage fills that change from section to section, the hero panel, centred
 * section intros with the brand mark set inline, and the cards of a deck (`Deck` in `home-client.tsx` holds them).
 * Server components only.
 */

export type StageTone = "brand" | "deep" | "ink" | "pale";

/** A stage fill with its on-colour (AA for all text on it). */
export const STAGE_FILL: Record<StageTone, string> = {
  brand: "bg-stage-brand text-on-stage-brand",
  deep: "bg-stage-deep text-on-stage-deep",
  ink: "bg-stage-ink text-on-stage-ink",
  pale: "bg-stage-pale text-on-stage-pale",
};

/** The focus ring in the on-colour, for controls whose ring falls on the fill. A card on the fill sets it back to the accent. */
export const STAGE_RING: Record<StageTone, string> = {
  brand: "[--focus-ring:var(--on-stage-brand)]",
  deep: "[--focus-ring:var(--on-stage-deep)]",
  ink: "[--focus-ring:var(--on-stage-ink)]",
  pale: "[--focus-ring:var(--on-stage-pale)]",
};

/** Section spacing: lots of air above each intro (96 px on phones, 144 px from 768 px). */
export const STAGE_SPACE = "pt-24 md:pt-36";

/**
 * A full-bleed band in one flat stage fill (no gradient into the next one): its text takes the on-colour and focus
 * rings the on-colour too. A plain `div`: the sections inside it carry the headings.
 */
export function Stage({ tone, className, children }: { tone: StageTone; className?: string; children: ReactNode }) {
  return <div className={cn("w-full", STAGE_FILL[tone], STAGE_RING[tone], className)}>{children}</div>;
}

/**
 * The text with the brand mark set inline before its last word, at the cap height, kept on one line with that word
 * (`O teu mercado, de ▲ perto.`). The mark is decorative, so the text reads the same to assistive technology.
 */
export function MarkedText({ text }: { text: string }) {
  const split = text.lastIndexOf(" ");
  if (split < 0) return text;
  return (
    <>
      {text.slice(0, split)}{" "}
      <span className="whitespace-nowrap">
        {/* The glyph sits left in its square, so its own right margin is the gap before the word. */}
        <PalancaMark className="size-[0.78em] align-[-0.04em]" />
        {text.slice(split + 1)}
      </span>
    </>
  );
}

/** The soft pill under a section intro, per fill it sits on: the soft accent tint on the canvas, a light veil on a stage. */
const INTRO_PILL = {
  canvas: buttonClass("secondary", undefined, "compact"),
  deep: cn(buttonShape("compact"), "bg-on-stage-deep/12 text-on-stage-deep hover:bg-on-stage-deep/20"),
} as const;

/**
 * A section's intro: the giant centred heading (`text-heading`, two lines at most) with the mark inline, then an
 * optional small soft pill to the section's page. `tone` is the fill the section sits on. A scroll-reveal group.
 */
export function SectionIntro({
  id,
  title,
  action,
  tone = "canvas",
}: {
  id: string;
  title: string;
  action?: { href: string; label: string };
  tone?: keyof typeof INTRO_PILL;
}) {
  return (
    <div data-reveal="stagger" className={cn(PAGE_CONTAINER, "flex flex-col items-center gap-8 text-center md:gap-10")}>
      <h2 id={id} className="max-w-5xl text-heading text-balance">
        <MarkedText text={title} />
      </h2>
      {action ? (
        <Link href={action.href} prefetch={false} className={INTRO_PILL[tone]}>
          {action.label}
          <Icon name="arrow-up-right" className="text-[1rem]" />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * The hero panel: a large rounded `stage-deep` panel inset from the window's edges, right under the floating top bar
 * and about one window tall, with a few decorative shapes at its edges; `children` (the title and one large pill) are
 * centred in it. The `h1` is the largest paint, so it never fades in.
 */
export function HeroPanel({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn(
        "relative isolate mx-2 flex min-h-[max(30rem,calc(100svh-var(--top-bar-height)-1rem))] flex-col items-center justify-center gap-10 overflow-hidden rounded-card px-5 py-20 text-center sm:mx-4 sm:px-10 lg:mx-6 lg:min-h-[max(36rem,calc(100svh-var(--top-bar-height)-1.5rem))]",
        STAGE_FILL.deep,
        STAGE_RING.deep,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <span className="absolute -bottom-32 -left-24 size-72 rounded-full bg-stage-brand/30 sm:size-96" />
        <span className="absolute -top-14 -right-12 size-44 rotate-12 rounded-[3rem] bg-stage-brand/45 sm:size-56 lg:right-[8%]" />
        <span className="absolute top-[16%] left-[7%] hidden h-12 w-28 -rotate-6 rounded-full bg-on-stage-deep/10 md:block" />
        <PalancaMark className="absolute right-[6%] bottom-[8%] size-20 -rotate-12 text-stage-brand sm:size-28 lg:size-36" />
      </div>
      {children}
    </section>
  );
}

type Figure = { value: string; label: string };

/**
 * The catalogue's coverage figures under the market search. Phones: the kinds as an even stat row, each count above
 * its label, hairlines between the columns, no total (it is their sum). From 640 px: one inline strip, the total
 * first, each count in the display face beside its label.
 */
export function CoverageFigures({ total, items, className }: { total?: Figure; items: Figure[]; className?: string }) {
  return (
    <dl
      className={cn(
        "flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1.5 sm:gap-x-8",
        "max-sm:grid max-sm:w-full max-sm:auto-cols-fr max-sm:grid-flow-col max-sm:gap-0 max-sm:divide-x max-sm:divide-hairline",
        className,
      )}
    >
      {(total ? [total, ...items] : items).map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "flex flex-row-reverse items-baseline gap-1.5 max-sm:min-w-0 max-sm:flex-col-reverse max-sm:items-center max-sm:px-1",
            total && index === 0 && "max-sm:hidden",
          )}
        >
          <dt className="text-caption text-secondary-text max-[22.5rem]:text-[0.6875rem] sm:text-secondary">{item.label}</dt>
          <dd className="font-display text-secondary font-semibold text-primary-text max-sm:text-[1.375rem] max-sm:leading-none max-sm:tabular-nums sm:text-body">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One card of a deck, a whole-card link: a tall flat card in a stage fill, its statement (`text-statement`, the link's
 * name) at the top and the product visual in a frame that runs off its bottom edge. The visual is decorative:
 * hidden, inert and unselectable. 85 % of the row on phones (the next card peeks in), 352 px from 640 px, 472 px
 * from 1024 px; it snaps to the row's start.
 */
export function DeckCard({ href, statement, tone, children }: { href: string; statement: string; tone: StageTone; children: ReactNode }) {
  return (
    <li className="flex w-[min(85%,22rem)] shrink-0 snap-start sm:w-[22rem] lg:w-[29.5rem]">
      <Link
        href={href}
        prefetch={false}
        className={cn(
          "group/card motion-lift flex h-[27rem] w-full flex-col justify-between overflow-hidden rounded-card sm:h-[31rem] lg:h-[36rem]",
          STAGE_FILL[tone],
        )}
      >
        <h3 className="px-6 pt-6 font-display text-statement text-balance sm:px-8 sm:pt-8 lg:px-12 lg:pt-12">{statement}</h3>
        <div aria-hidden inert className="mx-3 mt-8 h-60 shrink-0 overflow-hidden rounded-t-[1.25rem] bg-canvas p-3 select-none sm:mx-5 sm:h-68 lg:mx-8 lg:h-80">
          {children}
        </div>
      </Link>
    </li>
  );
}
