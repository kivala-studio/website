import { describe, expect, it } from "vitest";

import { doubleBitPattern, foldedWords, normalizedSourceURL, sha256Hex, swiftDouble } from "./keys";

describe("receipt key text", () => {
  it("matches the Foundation and CryptoKit forms", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("Publicação ".repeat(10))).toHaveLength(64);
    expect(swiftDouble(1790000000)).toBe("1790000000.0");
    expect(swiftDouble(1790000000.5)).toBe("1790000000.5");
    expect(doubleBitPattern(1)).toBe("4607182418800017408");
    expect(normalizedSourceURL("HTTPS://Source.AO/Results?a=B#section")).toBe("https://source.ao/Results?a=B");
    expect(foldedWords("Resultados  BAI!")).toBe(foldedWords("resultados bai"));
    expect(foldedWords("Ação: Título")).toBe("acao titulo");
  });
});
