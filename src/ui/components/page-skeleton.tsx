import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "../cn";
import { Card } from "./layout";
import { InstrumentRowSkeleton, Skeleton } from "./states";

/*
 * Route skeletons: what a route's `loading.tsx` shows the moment a link to it is pressed, inside the shell (top bar,
 * tab bar, rail, footer stay), while the server renders the page. Shaped and sized like the page's template, so the
 * page replaces it without a jump. Server-safe; built from `Skeleton` and the same surfaces as the page.
 */

/**
 * The skeleton's root: announced once as loading (`role="status"`, `aria-busy`, "A carregar" for assistive
 * technology). `as="main"` for a page that renders its own `<main id="main">`; market pages get theirs from the layout.
 */
export function PageSkeleton({ as: Root = "div", className, children }: { as?: "main" | "div"; className?: string; children: ReactNode }) {
  const t = useTranslations("common");
  return (
    <Root id={Root === "main" ? "main" : undefined} role="status" aria-busy="true" className={className}>
      <span className="sr-only">{t("loading")}</span>
      {children}
    </Root>
  );
}

/** A page title (`h1`, `text-display`) still to come: a block on the title's own line box. `className` sets its width. */
export function TitleSkeleton({ className }: { className?: string }) {
  return (
    <span aria-hidden className="flex h-10 items-center desk:h-9">
      <Skeleton className={cn("h-8 w-44 desk:h-7", className)} />
    </span>
  );
}

/**
 * A page's title row: the real `h1` when the route knows its title (`title`), a `TitleSkeleton` when it is data
 * (a portfolio's or an instrument's name); then `actions` round icon-button places (48 px, 44 on desk) and, with
 * `pill`, a pill button's. The actions wrap under the title on a narrow phone, as the pages' own rows do.
 */
export function PageHeadingSkeleton({ title, actions = 0, pill = false }: { title?: string; actions?: number; pill?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {title ? (
        <h1 className="min-w-0 grow text-display text-primary-text">{title}</h1>
      ) : (
        <span className="min-w-0 grow">
          <TitleSkeleton />
        </span>
      )}
      {actions > 0 || pill ? (
        <span aria-hidden className="flex items-center gap-2">
          {Array.from({ length: actions }, (_, index) => (
            <Skeleton key={index} className="size-12 shrink-0 rounded-full desk:size-11" />
          ))}
          {pill ? <Skeleton className="h-14 w-28 rounded-full desk:h-11" /> : null}
        </span>
      ) : null}
    </div>
  );
}

/** A card title row (`CardHeader`: 44 px, `text-section`) still to come. */
export function CardTitleSkeleton({ className }: { className?: string }) {
  return (
    <span aria-hidden className="flex min-h-11 items-center">
      <Skeleton className={cn("h-5 w-36", className)} />
    </span>
  );
}

/**
 * A `Card` still loading: a title row (unless `title={false}`) over `children`, or over `lines` text lines.
 * `className` sizes it like the card it stands for (`min-h-…`, grid placement).
 */
export function CardSkeleton({ title = true, lines = 3, className, children }: { title?: boolean; lines?: number; className?: string; children?: ReactNode }) {
  return (
    <Card aria-hidden className={cn("flex flex-col gap-3", className)}>
      {title ? <CardTitleSkeleton /> : null}
      {children ??
        Array.from({ length: lines }, (_, index) => <Skeleton key={index} className={cn("h-4", index === lines - 1 && lines > 1 ? "w-2/3" : "w-full")} />)}
    </Card>
  );
}

/** A titled `Panel` still loading: the canvas itself on phones, a card from 1024 px, with the panel's own insets. */
export function PanelSkeleton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section aria-hidden className={cn("flex min-w-0 flex-col lg:panel", className)}>
      <div className="pb-2 lg:px-6 lg:pt-5">
        <CardTitleSkeleton />
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:p-6 lg:pt-2">{children}</div>
    </section>
  );
}

/** Instrument rows still loading (`InstrumentRowSkeleton`), hairlines between them, in a card or a panel. */
export function RowsSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("flex flex-col divide-y divide-hairline", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <InstrumentRowSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * A data table still loading, in the flush card tables sit in: the 48 px header row and `rows` 60 px rows (logo,
 * name, trailing figures that fold on phones as the table's columns do), with the table's 16 / 24 px insets.
 */
export function TableSkeleton({ rows = 8, className }: { rows?: number; className?: string }) {
  const edge = "px-4 desk:px-6";
  return (
    <Card flush aria-hidden className={cn("overflow-hidden panel", className)}>
      <div className={cn("flex h-12 items-center justify-between gap-6 border-b border-hairline", edge)}>
        <Skeleton className="h-3.5 w-24" />
        <span className="flex gap-10">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-3.5 w-16 max-sm:hidden" />
          <Skeleton className="h-3.5 w-16 max-md:hidden" />
        </span>
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={cn("flex h-15 items-center gap-3 border-b border-hairline last:border-b-0", edge)}>
          <Skeleton className="size-8 shrink-0 rounded-full max-[22.5rem]:hidden" />
          <Skeleton className="h-4 w-1/3 max-w-48" />
          <span className="ml-auto flex gap-10">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-14 max-sm:hidden" />
            <Skeleton className="h-4 w-16 max-md:hidden" />
          </span>
        </div>
      ))}
    </Card>
  );
}
