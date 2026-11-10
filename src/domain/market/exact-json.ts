import Decimal from "decimal.js";

/*
 * `JSON.parse` turns every number into a binary float before it reaches `Decimal`, so a
 * numeric(24,8) price with more than ~15 significant digits would silently change. These helpers
 * keep the server's digits: a number literal that does not survive the float round trip is quoted
 * and reaches the decoders as a string, which they read with `new Decimal(text)`.
 */

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?/y;

const survivesFloat = (literal: string) => new Decimal(literal).equals(new Decimal(Number(literal)));

/** The same JSON text with every number literal that a float would change turned into a string. */
export function quoteInexactNumbers(text: string): string {
  let result = "";
  let copied = 0;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === '"') {
      // Skip the string, honouring escapes.
      index += 1;
      while (index < text.length && text[index] !== '"') index += text[index] === "\\" ? 2 : 1;
      index += 1;
      continue;
    }
    if (char === "-" || (char >= "0" && char <= "9")) {
      NUMBER.lastIndex = index;
      const match = NUMBER.exec(text);
      if (!match) return text; // Not JSON; let JSON.parse report it.
      const literal = match[0];
      if (!survivesFloat(literal)) {
        result += `${text.slice(copied, index)}"${literal}"`;
        copied = index + literal.length;
      }
      index += literal.length;
      continue;
    }
    index += 1;
  }
  return copied === 0 ? text : result + text.slice(copied);
}

/** `JSON.parse` that keeps every financial digit (see `quoteInexactNumbers`). */
export const parseExactJson = (text: string): unknown => JSON.parse(quoteInexactNumbers(text));
