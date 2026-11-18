/*
 * Text field class names (the search field's look: a hairline box on the card surface, an accent ring on focus),
 * kept outside client modules so server components can style their inputs too. The box stays visible on a white
 * card or dialog, where the old elevated fill disappeared.
 */

const RING = "focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-accent/30";

/** A box around an input and its prefix or suffix (`Kz`, `%`); the input inside is bare (`INPUT_BARE`). */
export const INPUT_BOX = `flex min-h-12 items-center gap-2 rounded-medium border border-field-border bg-card-background px-3 transition-colors desk:min-h-11 ${RING}`;

/** The bare input inside an `INPUT_BOX`. */
export const INPUT_BARE = "min-w-0 flex-1 bg-transparent py-2 text-body text-primary-text outline-none placeholder:text-secondary-text";

/** A standalone input or select. */
export const INPUT =
  "min-h-12 w-full rounded-medium border border-field-border bg-card-background px-3 text-body text-primary-text transition-colors placeholder:text-secondary-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/30 desk:min-h-11";
