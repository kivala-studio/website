/*
 * Text field class names (the search field's look: a hairline box on the card surface), kept outside client modules
 * so server components can style their inputs too. The box stays visible on a white card or dialog, where the old
 * elevated fill disappeared. A focused field never shows an outline (the base layer removes it from every text
 * input, textarea and select): its border turns accent and a soft glow (`--focus-glow`) rings it, on mouse and
 * keyboard focus alike.
 */

/** Focus on a field that is itself the box (an input or select with `INPUT`). */
export const FIELD_FOCUS = "focus:border-accent focus:shadow-focus";

/** Focus on a box around a bare input (`INPUT_BOX`, the search field): the box lights up while anything inside has focus. */
export const FIELD_FOCUS_WITHIN = "focus-within:border-accent focus-within:shadow-focus";

const TRANSITION = "transition-[border-color,box-shadow] motion-reduce:transition-none";

/** A box around an input and its prefix or suffix (`Kz`, `%`); the input inside is bare (`INPUT_BARE`). */
export const INPUT_BOX = `flex min-h-12 items-center gap-2 rounded-medium border border-field-border bg-card-background px-3 desk:min-h-11 ${TRANSITION} ${FIELD_FOCUS_WITHIN}`;

/** The bare input inside an `INPUT_BOX`: no border, no glow of its own. */
export const INPUT_BARE = "min-w-0 flex-1 bg-transparent py-2 text-body text-primary-text placeholder:text-secondary-text";

/** A standalone input or select. */
export const INPUT = `min-h-12 w-full rounded-medium border border-field-border bg-card-background px-3 text-body text-primary-text placeholder:text-secondary-text desk:min-h-11 ${TRANSITION} ${FIELD_FOCUS}`;
