import { describe, expect, it } from "vitest";

import { profileInitials } from "./account";
import { readSignInReason, safeNextPath, signInHref } from "./next-path";

describe("safeNextPath", () => {
  it.each([
    ["/carteira", "/carteira"],
    ["/en/lista?grupo=banca#topo", "/en/lista?grupo=banca#topo"],
    ["/mercado/BAI", "/mercado/BAI"],
    ["/a/../carteira", "/carteira"],
  ])("keeps the same-origin path %s", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  it.each([
    "https://evil.example/carteira",
    "//evil.example/carteira",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
    "carteira",
    "",
    "/entrar?next=/carteira",
    "/en/entrar",
    "/auth/callback?code=x",
    `/${"a".repeat(2048)}`,
  ])("ignores %j", (raw) => {
    expect(safeNextPath(raw)).toBe("/inicio");
  });

  it("ignores missing values and uses the given fallback", () => {
    expect(safeNextPath(null)).toBe("/inicio");
    expect(safeNextPath(undefined, "/en/inicio")).toBe("/en/inicio");
  });
});

describe("signInHref", () => {
  it("carries the destination and reason, in the destination's language", () => {
    expect(signInHref("/carteira")).toBe("/entrar?next=%2Fcarteira");
    expect(signInHref("/en/carteira", "expired")).toBe("/en/entrar?next=%2Fen%2Fcarteira&motivo=sessao");
    expect(signInHref("//evil.example")).toBe("/entrar");
    expect(readSignInReason("sessao")).toBe("expired");
    expect(readSignInReason("other")).toBeNull();
  });
});

describe("profileInitials", () => {
  it("uses the first and last words, or I without a name", () => {
    expect(profileInitials("Inês Maria Tavares")).toBe("IT");
    expect(profileInitials("ana")).toBe("A");
    expect(profileInitials("  ")).toBe("I");
  });
});
