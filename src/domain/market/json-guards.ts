import Decimal from "decimal.js";

import { MarketDecodingError } from "./decoding-error";

/*
 * Row guards for the detail decoders (intraday chart, order book), with the `decode.ts` semantics:
 * an optional key may be missing or null but, when present, must have the right type.
 */

export type JsonObject = Readonly<Record<string, unknown>>;
export type JsonRead<T> = (value: unknown, path: string) => T;

const fail = (operation: string, path: string, expected: string): never => {
  throw new MarketDecodingError(operation, `${path}: expected ${expected}`);
};

const NUMERIC_TEXT = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;

export function jsonGuards(operation: string) {
  const object = (value: unknown, path: string): JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonObject) : fail(operation, path, "object");
  const string: JsonRead<string> = (value, path) => (typeof value === "string" ? value : fail(operation, path, "string"));
  const integer: JsonRead<number> = (value, path) =>
    Number.isInteger(value) ? (value as number) : fail(operation, path, "integer");
  /** JSON numbers, or numeric text from `parseExactJson`, read without a binary float in between when possible. */
  const decimal: JsonRead<Decimal> = (value, path) => {
    if (typeof value === "number" && Number.isFinite(value)) return new Decimal(value);
    if (typeof value === "string" && NUMERIC_TEXT.test(value.trim())) return new Decimal(value.trim());
    return fail(operation, path, "decimal");
  };
  const array =
    <T>(item: JsonRead<T>): JsonRead<T[]> =>
    (value, path) =>
      Array.isArray(value) ? value.map((element, index) => item(element, `${path}[${index}]`)) : fail(operation, path, "array");
  const required = <T>(record: JsonObject, key: string, read: JsonRead<T>, path: string) => read(record[key], `${path}.${key}`);
  const optional = <T>(record: JsonObject, key: string, read: JsonRead<T>, path: string): T | undefined =>
    record[key] === undefined || record[key] === null ? undefined : read(record[key], `${path}.${key}`);
  return { fail: (path: string, expected: string) => fail(operation, path, expected), object, string, integer, decimal, array, required, optional };
}
