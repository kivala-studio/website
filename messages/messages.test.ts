import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "./en.json";
import pt from "./pt.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [nested, text] of flatten(value, path)) out.set(nested, text);
  }
  return out;
}

/** Argument names outside ICU quotes ('…'). */
function argumentsOf(message: string): string[] {
  const unquoted = message.replace(/''/g, "").replace(/'[^']*'/g, "");
  return [...unquoted.matchAll(/\{\s*([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]).sort();
}

const ptMessages = flatten(pt as Tree);
const enMessages = flatten(en as Tree);

describe("messages", () => {
  it("have the same keys in pt and en", () => {
    expect([...enMessages.keys()].sort()).toEqual([...ptMessages.keys()].sort());
  });

  it("use the same arguments in both languages", () => {
    const mismatched = [...ptMessages].filter(([key, text]) => {
      const other = enMessages.get(key);
      return other === undefined || argumentsOf(other).join() !== argumentsOf(text).join();
    });
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });

  it("all parse and render", () => {
    for (const [locale, messages, flat] of [["pt", pt, ptMessages], ["en", en, enMessages]] as const) {
      const t = createTranslator({ locale, messages, onError: (error) => { throw error; } });
      for (const [key, text] of flat) {
        const values = Object.fromEntries(argumentsOf(text).map((name) => [name, "x"]));
        expect(() => t(key as never, values as never)).not.toThrow();
      }
    }
  });
});
