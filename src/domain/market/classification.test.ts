import { describe, expect, it } from "vitest";

import { classifySecurityKind } from "./classification";

const kind = (type: string, symbol: string, name?: string) => classifySecurityKind({ type, name, symbol });

describe("security kind classification", () => {
  it("canonical types take priority", () => {
    expect(kind("stock", "BAIAAAAA")).toBe("equity");
    expect(kind("bond", "BAIODOFA")).toBe("corporateBond");
    expect(kind("treasury_bond", "OI15S29B")).toBe("treasuryBond");
  });

  it("BODIVA debt symbols recover missing metadata", () => {
    const treasury = ["BC04D23A", "BE14F26A", "OG12F29A", "OH15L29C", "OI08I30A", "OJ08M30A", "OK05A29B", "OL01U31A", "ON30J33A", "OO01I34A"];
    for (const symbol of treasury) expect(kind("other", symbol), symbol).toBe("treasuryBond");
    for (const symbol of ["BAIODOFA", "SBAODOFA", "GRINDOFA", "SNLEDOFB"]) expect(kind("other", symbol), symbol).toBe("corporateBond");
  });

  it("equity symbols are not mistaken for issuer bonds", () => {
    for (const symbol of ["BAIAAAAA", "BFAAAAAA", "BCGAAAAA", "BDVAAAAA", "ENSAAAAA", "UNTLAAAA"]) {
      expect(kind("other", symbol), symbol).toBe("equity");
    }
  });

  it("ticker structure takes priority over conflicting metadata", () => {
    expect(kind("stock", "BAIODOFA")).toBe("corporateBond");
    expect(kind("stock", "BE14F26A")).toBe("treasuryBond");
    expect(kind("bond", "BAIAAAAA")).toBe("equity");
  });

  it("funds and unknown symbols do not fall back to equity", () => {
    expect(kind("other", "BFAUUFVA")).toBe("fund");
    expect(kind("other", "STDRUFVB")).toBe("fund");
    expect(kind("other", "ABCDEFGH")).toBe("other");
  });
});
