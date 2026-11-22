import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "@/ui/cn";
import { buttonShape } from "@/ui/components/button-styles";
import { DataTable } from "@/ui/components/table";

import { STAGE_FILL, STAGE_RING } from "./home";

/*
 * `/plus`, the public page of the one paid plan: the prepaid web passes and their prices (when the server has passes on
 * sale), what Plus adds to the free plan, and the App Store. Server-safe and free of server-only imports, so the
 * route skeleton can draw the same hero.
 */

/**
 * The hero: an inset `stage-deep` panel under the top bar (the landing's hero frame, as tall as its content) with the
 * page's `h1` and `children` (the passes and the pay pill, or the App Store pill) centred under it. The title rises once
 * on load (`motion-entrance-lift`) unless `still` (the route skeleton, which the page replaces).
 */
export function PlusHero({ title, still = false, children }: { title: string; still?: boolean; children: ReactNode }) {
  return (
    <section
      aria-labelledby="plus-title"
      className={cn(
        "mx-2 flex flex-col items-center gap-10 rounded-card px-4 py-16 text-center sm:mx-4 sm:px-10 md:py-20 lg:mx-6 lg:gap-12 lg:py-24",
        STAGE_FILL.deep,
        STAGE_RING.deep,
      )}
    >
      <h1 id="plus-title" className={cn("max-w-[13ch] text-hero text-balance", !still && "motion-entrance-lift")}>
        {title}
      </h1>
      {children}
    </section>
  );
}

/** A large pill on the hero's `stage-deep` fill, in its on-colour (the landing hero's App Store pill). */
export const HERO_PILL_FILL = "bg-on-stage-deep text-stage-deep hover:bg-on-stage-deep/90 max-sm:whitespace-normal";

export type PlusPass = { id: string; months: string; price: string; saving?: string };

/**
 * The passes on sale as two cards on the card fill (shortest first; side by side from 640 px): the length, the 12-month
 * saving as a soft pill, the price as the hero figure. Then the payment methods and the one pill to `/planos`.
 */
export function PlusPasses({ passes, methods, pay }: { passes: readonly PlusPass[]; methods: string; pay: { href: string; label: string } }) {
  return (
    <div className="flex w-full max-w-3xl motion-entrance flex-col items-center gap-8 entrance-delay-70">
      <ul className={cn("grid w-full gap-3 sm:gap-4", passes.length > 1 && "sm:grid-cols-2")}>
        {passes.map((pass) => (
          <li
            key={pass.id}
            data-testid="plus-pass"
            className="flex flex-col items-start gap-3 rounded-card bg-card-background p-5 text-left text-primary-text [--focus-ring:var(--accent)] sm:p-8"
          >
            <div className="flex min-h-7 w-full flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="font-display text-section">{pass.months}</p>
              {pass.saving ? <p className="rounded-full bg-accent-soft px-2.5 py-1 text-caption font-semibold text-accent">{pass.saving}</p> : null}
            </div>
            <p className="font-display text-headline max-[22.5rem]:text-[2.25rem]" data-testid="plus-price">
              {pass.price}
            </p>
          </li>
        ))}
      </ul>
      <p className="max-w-2xl text-body text-balance">{methods}</p>
      <div className="flex max-w-full">
        {/* `/planos` lives on the signed-in app's host; a visitor without a session signs in on the way. */}
        <a href={pay.href} className={cn(buttonShape("large"), HERO_PILL_FILL)}>
          {pay.label}
        </a>
      </div>
    </div>
  );
}

/** A value of the comparison: a catalogue string, or `null` for a feature the plan does not include. */
export type PlusFeature = { feature: string; free: string | null; plus: string };

/**
 * From 640 px a plain three-column table. Below it each row is a two-column grid (the feature over its two values, under
 * the plan headers), so no value breaks inside a word at 320 px. The explicit roles keep the table's semantics while
 * its rows are grids.
 */
const ROW = "border-b border-hairline max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-3 max-sm:px-4";
const HEAD = "px-3 font-sans text-caption font-semibold tracking-[0.06em] whitespace-nowrap max-sm:py-3.5 sm:h-12 sm:first:pl-4 sm:last:pr-4 desk:first:pl-6 desk:last:pr-6";
const CELL = "align-middle font-display text-body sm:px-3 sm:py-3.5 sm:first:pl-4 sm:last:pr-4 desk:first:pl-6 desk:last:pr-6";

/**
 * Grátis against Plus (the iOS subscription screen's rows and wording), as a real table in a flush card: the feature
 * is the row header, then its value in each plan. A feature the free plan lacks shows a muted dash, read as
 * "Não incluído". `labelledBy` names the table.
 */
export function PlusComparison({ rows, labelledBy }: { rows: readonly PlusFeature[]; labelledBy: string }) {
  const t = useTranslations();
  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden panel">
      <DataTable role="table" className="max-sm:block sm:table-fixed" aria-labelledby={labelledBy} data-testid="plus-comparison">
        <thead role="rowgroup" className="max-sm:block">
          <tr role="row" className={ROW}>
            <th role="columnheader" scope="col" className={cn(HEAD, "text-left text-secondary-text max-sm:sr-only")}>
              {t("subscriptions.comparison.featureHeader")}
            </th>
            <th role="columnheader" scope="col" className={cn(HEAD, "text-center text-secondary-text sm:w-36")}>
              {t("subscriptions.comparison.freeHeader")}
            </th>
            <th role="columnheader" scope="col" className={cn(HEAD, "text-center text-accent sm:w-48")}>
              {t("subscriptions.comparison.plusHeader")}
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup" className="max-sm:block">
          {rows.map((row) => (
            <tr key={row.feature} role="row" className={cn(ROW, "last:border-b-0 max-sm:gap-y-1.5 max-sm:py-3.5")}>
              <th role="rowheader" scope="row" className={cn(CELL, "text-left font-medium text-primary-text max-sm:col-span-2")}>
                {row.feature}
              </th>
              <td role="cell" className={cn(CELL, "text-center text-secondary-text")}>
                {row.free ?? (
                  <>
                    <span aria-hidden className="text-tertiary-text">
                      —
                    </span>
                    <span className="sr-only">{t("site.plus.notIncluded")}</span>
                  </>
                )}
              </td>
              <td role="cell" className={cn(CELL, "text-center font-semibold text-primary-text")}>
                {row.plus}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
