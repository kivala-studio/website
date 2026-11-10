import Decimal from "decimal.js";

import { formatNumber, groupDigits } from "./number";

const NBSP = " ";
const STRICT = /^[+-]?(?:[0-9]+|[0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{1,3}(?: [0-9]{3})+)(?:,[0-9]+)?$/;
const isSpace = (character: string) => /\s/u.test(character);

/**
 * Strict Portuguese amount: comma decimals, optional groups of three digits separated
 * consistently by dots or spaces. Never accepts a prefix. Port of iOS `SimulationNumberParser`.
 */
export function parseAmount(text: string): Decimal | null {
  const value = text.trim().replaceAll(NBSP, " ").replaceAll(" ", " ");
  if (!STRICT.test(value)) return null;
  const normalized = value.replaceAll(".", "").replaceAll(" ", "").replace(",", ".");
  const digits = normalized.replace(/[^0-9]/g, "");
  const significant = digits.replace(/^0+/, "").replace(/0+$/, "");
  if (significant.length > 38) return null;
  const result = new Decimal(normalized);
  if (result.isNaN() || (result.isZero() && /[1-9]/.test(digits))) return null;
  return result;
}

/** Reformats a completed entry with grouping and at least two decimals; invalid text is kept for validation. */
export function formatCompletedAmount(text: string): string {
  const value = parseAmount(text);
  if (!value) return text;
  return formatNumber(value, "pt", { minFraction: 2, maxFraction: 38 });
}

/** A stored amount shown in an input: grouped, 2–8 decimals, always pt_AO (comma decimals in both languages). */
export const formatAmountForInput = (value: Decimal.Value) =>
  formatNumber(value, "pt", { minFraction: 2, maxFraction: 8 });

/** Groups an in-progress edit without rounding, padding or dropping a trailing comma. */
export function groupAmountDraft(text: string): string | null {
  // A pasted dot is accepted only as a valid Portuguese thousands separator.
  if (text.includes(".") && parseAmount(text) === null) return null;
  let raw = [...text].filter((character) => !isSpace(character) && character !== ".").join("");
  if (!/^-?[0-9]*(?:,[0-9]*)?$/.test(raw)) return null;
  if (raw === "" || raw === "-") return raw;
  const negative = raw.startsWith("-");
  if (negative) raw = raw.slice(1);
  const [integerPart, fraction] = raw.split(",");
  const integer = integerPart === "" ? "0" : integerPart;
  return `${negative ? "-" : ""}${groupDigits(integer, NBSP)}${fraction === undefined ? "" : `,${fraction}`}`;
}

export type AmountEdit = { text: string; caret: number };

/**
 * Applies a keystroke or paste to `text` between `start` and `end` (UTF-16 offsets) and keeps the caret
 * next to the same digit. Returns null when the edit must be rejected. Port of iOS `AngolanAmountEditing`.
 */
export function editAmount(text: string, start: number, end: number, replacement: string): AmountEdit | null {
  if (start < 0 || end < start || end > text.length) return null;
  let from = start;
  // Backspacing a generated grouping space removes the digit before it.
  if (replacement === "" && end - start === 1 && start > 0 && isSpace(text.slice(start, end))) from -= 1;
  const insertion = replacement === "." ? "," : replacement;
  const proposed = text.slice(0, from) + insertion + text.slice(end);
  const formatted = groupAmountDraft(proposed);
  if (formatted === null) return null;

  const suffix = proposed.slice(from + insertion.length);
  let remaining = [...suffix].filter((character) => !isSpace(character) && character !== ".").length;
  let caret = formatted.length;
  while (caret > 0 && remaining > 0) {
    caret -= 1;
    if (!isSpace(formatted[caret])) remaining -= 1;
  }
  return { text: formatted, caret };
}
