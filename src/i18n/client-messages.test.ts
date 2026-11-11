import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import pt from "../../messages/pt.json";
import { AREA_KEYS, CLIENT_KEYS, pickClientMessages } from "./client-messages";

const formatterKeys = [
  ...readFileSync(new URL("../domain/format/index.ts", import.meta.url), "utf8").matchAll(/translate\("([^"]+)"/g),
].map((match) => match[1]);

const lookup = (tree: unknown, key: string) =>
  key.split(".").reduce<unknown>((node, segment) => (node && typeof node === "object" ? (node as Record<string, unknown>)[segment] : undefined), tree);

describe.each([
  ["pt", pt],
  ["en", en],
] as const)("client messages (%s)", (_, messages) => {
  const picked = pickClientMessages(messages);

  it("ship every key the shared formatter and the error presenter use", () => {
    const missing = [...formatterKeys, ...CLIENT_KEYS].filter((key) => typeof lookup(picked, key) !== "string");
    expect(missing).toEqual([]);
  });

  it("resolve every per-area key", () => {
    const missing = Object.values(AREA_KEYS)
      .flat()
      .filter((key) => lookup(messages, key) === undefined);
    expect(missing).toEqual([]);
  });
});
