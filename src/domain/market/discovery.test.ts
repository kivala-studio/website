import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import pt from "../../../messages/pt.json";
import { createFormat } from "../format";
import { bodivaMaturityDate, isMaturedBond, isVisibleOutsideSearch, resolvedLogoURL, securityDisplayName, visibleOutsideSearch } from "./classification";
import { applyDiscoveryQuery, kindSearchTerms, recordRecentSearch, searchSecurities } from "./discovery";
import { type MarketSecurity, type QuoteAvailability, type SecurityKind, marketSecurity } from "./models";
import { qualityFailure } from "./quality";
import {
  displayPercentageChange,
  displayPrice,
  displayPriceChange,
  hasDisplayMovement,
  hasSessionQuote,
  hasUsableQuote,
  movementIsAvailable,
  usesReferenceDisplayPrice,
} from "./quote-policy";
import { DAY_MS, civilDate, dayStart, parseInstant, startOfDay } from "./zone";

const translate = (key: string) => {
  const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], pt);
  return typeof value === "string" ? value : key;
};
const instant = (value: string) => parseInstant(value) ?? Number.NaN;
const now = instant("2026-10-05T10:00:00Z");
const kindTerms = kindSearchTerms(translate);

function makeSecurity(input: {
  symbol: string;
  name: string;
  issuer: string;
  kind: SecurityKind;
  price: number;
  change: number;
  volume: number;
  quoteAvailability?: QuoteAvailability;
  logoURL?: string;
  issuerWebsiteURL?: string;
  id?: string;
}): MarketSecurity {
  const available = (input.quoteAvailability ?? "available") === "available";
  const price = new Decimal(input.price);
  return marketSecurity({
    id: input.id ?? input.symbol,
    symbol: input.symbol,
    name: input.name,
    issuer: input.issuer,
    kind: input.kind,
    price,
    percentageChange: new Decimal(input.change),
    volume: new Decimal(input.volume),
    quoteAvailability: input.quoteAvailability ?? "available",
    logoURL: input.logoURL,
    issuerWebsiteURL: input.issuerWebsiteURL,
    closingPrice:
      price.isFinite() && price.gt(0) && available
        ? { price, tradingDate: now - DAY_MS, confirmedAt: now, percentageChange: new Decimal(input.change) }
        : undefined,
  });
}

const securities = [
  makeSecurity({ symbol: "AAA", name: "Alpha Investimentos", issuer: "Banco Alpha", kind: "equity", price: 40, change: 2.4, volume: 300 }),
  makeSecurity({ symbol: "BBB", name: "Obrigação Kwanza", issuer: "Banco Beta", kind: "corporateBond", price: 80, change: -1.2, volume: 200 }),
  makeSecurity({ symbol: "CCC", name: "Título do Tesouro", issuer: "Tesouro Nacional", kind: "treasuryBond", price: 120, change: 0.5, volume: 100 }),
  makeSecurity({ symbol: "DDD", name: "Delta Seguros", issuer: "Seguradora Delta", kind: "equity", price: 20, change: 0, volume: 400 }),
];

const symbols = (query: Parameters<typeof applyDiscoveryQuery>[1], items = securities, at = now) =>
  applyDiscoveryQuery(items, query, at).map((security) => security.symbol);

describe("market discovery", () => {
  it("display name uses the issuer when the instrument name repeats the symbol", () => {
    const security = makeSecurity({ symbol: "BDVAAAAA", name: "BDVAAAAA", issuer: "BODIVA", kind: "equity", price: 97_000, change: 0, volume: 0 });
    expect(securityDisplayName(security)).toBe("BODIVA");
  });

  it("unavailable prices keep instrument names visible across discovery and search", () => {
    for (const kind of ["equity", "fund", "corporateBond", "treasuryBond", "other"] as const) {
      const unavailable = makeSecurity({
        symbol: "UNQUOTED", name: "Sem cotação", issuer: "Emitente", kind, price: 100, change: 0, volume: 0, quoteAvailability: "unavailable",
      });
      expect(applyDiscoveryQuery([unavailable], {}, now)).toHaveLength(1);
      expect(searchSecurities([unavailable], "UNQUOTED", { now, kindTerms })).toHaveLength(1);
      expect(visibleOutsideSearch([unavailable], now)).toHaveLength(1);
    }
    for (const price of [0, -1, Number.POSITIVE_INFINITY, Number.NaN]) {
      const invalid = makeSecurity({ symbol: "INVALID", name: "Cotação inválida", issuer: "Emitente", kind: "equity", price, change: 0, volume: 0 });
      expect(isVisibleOutsideSearch(invalid, now)).toBe(true);
      expect(displayPrice(invalid, now)).toBeUndefined();
    }
  });

  it("compact chart axis labels", () => {
    const { chartAxis } = createFormat("pt", translate);
    expect(chartAxis(230_000)).toBe("230k");
    expect(chartAxis(1_500)).toBe("1,5k");
    expect(chartAxis(1_250_000)).toBe("1,25M");
    expect(chartAxis(2_000_000_000)).toBe("2B");
    expect(chartAxis(-230_000)).toBe("-230k");
    expect(chartAxis(99.75)).toBe("99,75");
    expect(chartAxis(0)).toBe("0");
  });

  it("parses BODIVA maturity codes", () => {
    const maturity = bodivaMaturityDate("OI27S22A");
    expect(maturity).toBeDefined();
    expect(civilDate(maturity!)).toBe("2022-09-27");
  });

  it("matured bonds are excluded from discovery even when searching", () => {
    const reference = dayStart("2026-09-07") ?? Number.NaN;
    const candidates = [
      makeSecurity({ symbol: "OI27S22A", name: "Tesouro vencido", issuer: "República de Angola", kind: "treasuryBond", price: 1, change: 0, volume: 0 }),
      makeSecurity({ symbol: "EG15D25B", name: "Outro vencido", issuer: "República de Angola", kind: "other", price: 1, change: 0, volume: 0 }),
      makeSecurity({ symbol: "ON30J33A", name: "Tesouro vigente", issuer: "República de Angola", kind: "treasuryBond", price: 1, change: 0, volume: 0 }),
      makeSecurity({ symbol: "OI27S22A", name: "Obrigação corporativa histórica", issuer: "Emitente", kind: "corporateBond", price: 1, change: 0, volume: 0 }),
    ];
    expect(applyDiscoveryQuery(candidates, {}, reference).map((security) => security.name)).toEqual(["Tesouro vigente"]);
    expect(applyDiscoveryQuery(candidates, { searchText: "OI27S22A" }, reference)).toEqual([]);
  });

  it("a zero quote does not establish bond maturity", () => {
    const cases = [
      makeSecurity({ symbol: "BAIODOFA", name: "Obrigação corporativa vencida", issuer: "BAI", kind: "corporateBond", price: 0, change: 0, volume: 0 }),
      makeSecurity({ symbol: "BFAODOFA", name: "Obrigação corporativa activa", issuer: "BFA", kind: "corporateBond", price: 100, change: 0, volume: 0 }),
      makeSecurity({ symbol: "BAIAAAAA", name: "Acção sem cotação", issuer: "BAI", kind: "equity", price: 0, change: 0, volume: 0 }),
      makeSecurity({
        symbol: "SEM-DATA", name: "Obrigação sem cotação", issuer: "Emitente", kind: "corporateBond", price: 0, change: 0, volume: 0, quoteAvailability: "unavailable",
      }),
    ];
    for (const security of cases) expect(isMaturedBond(security, now), security.symbol).toBe(false);
  });

  it("malformed maturity codes remain visible", () => {
    const security = makeSecurity({ symbol: "SEM-DATA", name: "Formato desconhecido", issuer: "Emitente", kind: "other", price: 1, change: 0, volume: 0 });
    expect(isVisibleOutsideSearch(security, now)).toBe(true);
    expect(bodivaMaturityDate("OI31F26A")).toBeUndefined();
  });

  it("category filtering uses supported security kinds", () => {
    expect(symbols({ category: "equities" })).toEqual(["AAA", "DDD"]);
    expect(symbols({ category: "bonds" })).toEqual(["BBB"]);
    expect(symbols({ category: "treasury" })).toEqual(["CCC"]);
  });

  it("search matches ticker, name and issuer", () => {
    expect(symbols({ searchText: "AAA" })).toEqual(["AAA"]);
    expect(symbols({ searchText: "Kwanza" })).toEqual(["BBB"]);
    expect(symbols({ searchText: "Tesouro Nacional" })).toEqual(["CCC"]);
    expect(symbols({ searchText: "  Delta  " })).toEqual(["DDD"]);
  });

  const order = (sortKey: "percentageChange" | "price" | "volume" | "name", ascending: string[], descending: string[]) => {
    expect(symbols({ sortKey, direction: "ascending" })).toEqual(ascending);
    expect(symbols({ sortKey, direction: "descending" })).toEqual(descending);
  };

  it("sorts by percentage change in both directions", () => {
    order("percentageChange", ["BBB", "DDD", "CCC", "AAA"], ["AAA", "CCC", "DDD", "BBB"]);
  });

  it("sorts by price in both directions", () => {
    order("price", ["DDD", "AAA", "BBB", "CCC"], ["CCC", "BBB", "AAA", "DDD"]);
  });

  it("sorts by volume in both directions", () => {
    order("volume", ["CCC", "BBB", "AAA", "DDD"], ["DDD", "AAA", "BBB", "CCC"]);
  });

  it("sorts by name in both directions", () => {
    order("name", ["AAA", "DDD", "BBB", "CCC"], ["CCC", "BBB", "DDD", "AAA"]);
  });

  it("the logo URL prefers the curated issuer logo", () => {
    const security = makeSecurity({
      symbol: "BAI", name: "Banco Angolano de Investimentos", issuer: "BAI", kind: "equity", price: 1, change: 0, volume: 0,
      logoURL: "https://cdn.example.com/bai.png", issuerWebsiteURL: "https://www.bancobai.ao",
    });
    expect(resolvedLogoURL(security)).toBe("https://cdn.example.com/bai.png");
  });

  it("the logo URL falls back to the official website icon", () => {
    const security = makeSecurity({
      symbol: "BAI", name: "Banco Angolano de Investimentos", issuer: "BAI", kind: "equity", price: 1, change: 0, volume: 0,
      issuerWebsiteURL: "https://www.bancobai.ao",
    });
    const url = new URL(resolvedLogoURL(security) ?? "");
    expect(url.host).toBe("www.google.com");
    expect(url.searchParams.get("domain_url")).toBe("https://www.bancobai.ao");
    expect(url.searchParams.get("sz")).toBe("128");
  });

  it("the logo URL is absent without issuer metadata", () => {
    expect(resolvedLogoURL(securities[0])).toBeUndefined();
  });
});

describe("global search", () => {
  const universe = [
    makeSecurity({ id: "BAI", symbol: "BAI", name: "Banco Angolano de Investimentos", issuer: "Banco Angolano de Investimentos, S.A.", kind: "equity", price: 100, change: 1, volume: 100 }),
    makeSecurity({ id: "ENSA", symbol: "ENSA", name: "ENSA Seguros de Angola", issuer: "ENSA, S.A.", kind: "equity", price: 100, change: 1, volume: 100 }),
    makeSecurity({ id: "BFA-28", symbol: "BFA 2028", name: "Obrigações BFA 2028", issuer: "Banco de Fomento Angola, S.A.", kind: "corporateBond", price: 100, change: 1, volume: 100 }),
    makeSecurity({ id: "OT-27", symbol: "OT-NR-27", name: "OT Não Reajustável 2027", issuer: "República de Angola", kind: "treasuryBond", price: 100, change: 1, volume: 100 }),
  ];
  const search = (text: string, items = universe) => searchSecurities(items, text, { now, kindTerms }).map((security) => security.id);

  it("excludes matured securities", () => {
    const matured = makeSecurity({ symbol: "OI27S22A", name: "Tesouro vencido", issuer: "República de Angola", kind: "treasuryBond", price: 100, change: 1, volume: 100 });
    expect(search("OI27S22A", [matured])).toEqual([]);
  });

  it("matches ticker, name, issuer and security type", () => {
    expect(search("BAI")).toEqual(["BAI"]);
    expect(search("Seguros")).toEqual(["ENSA"]);
    expect(search("República")).toEqual(["OT-27"]);
    expect(search("corporativa")).toEqual(["BFA-28"]);
  });

  it("is whitespace, case and diacritic insensitive", () => {
    expect(search("  accao  ")).toEqual(["BAI", "ENSA"]);
    expect(search("  ação  ")).toEqual(["BAI", "ENSA"]);
  });

  it("an exact ticker ranks ahead of other matches", () => {
    const matchingName = makeSecurity({ id: "OTHER", symbol: "XYZ", name: "BAI Participações", issuer: "Outro Emitente", kind: "equity", price: 100, change: 1, volume: 100 });
    expect(search("BAI", [...universe, matchingName])).toEqual(["BAI", "OTHER"]);
  });

  it("recent selections move to the front and respect the limit", () => {
    let ids: string[] = [];
    for (let item = 0; item < 10; item += 1) ids = recordRecentSearch(ids, `SEC-${item}`);
    ids = recordRecentSearch(ids, "SEC-5");
    expect(ids).toHaveLength(8);
    expect(ids[0]).toBe("SEC-5");
    expect(new Set(ids).size).toBe(8);
  });
});

describe("market display movement", () => {
  const receipt = now / 1000;
  const security = (reportedChange: number | undefined, overrides: Partial<MarketSecurity> = {}): MarketSecurity =>
    marketSecurity({
      id: "BAIAAAAA",
      symbol: "BAIAAAAA",
      name: "BAI",
      issuer: "BAI",
      kind: "equity",
      price: new Decimal(94_500),
      percentageChange: new Decimal("0.052938061"),
      volume: new Decimal(83),
      quoteQuality: { status: "valid", reasons: [], validUntilEpoch: receipt + 120, sourceObservedAtEpoch: receipt },
      hasVerifiedMovement: false,
      reportedPercentageChange: reportedChange === undefined ? undefined : new Decimal(reportedChange),
      marketStatus: "open",
      quoteTradingDate: now,
      marketContextValidUntil: now + 120_000,
      ...overrides,
    });
  const text = (value: Decimal | undefined) => value?.toString();

  it("reported movement survives a missing verified baseline", () => {
    const asset = security(-0.88495575);
    expect(hasDisplayMovement(asset, now)).toBe(true);
    expect(text(displayPercentageChange(asset, now))).toBe("-0.88495575");
    expect(movementIsAvailable(asset, now)).toBe(false);
    expect(displayPriceChange(asset, now)).toBeUndefined();
  });

  it("reported rounding does not hide movement", () => {
    const asset = security(0.05293806, { hasVerifiedMovement: true });
    expect(displayPercentageChange(asset, now)?.eq(asset.percentageChange)).toBe(false);
    expect(hasDisplayMovement(asset, now)).toBe(true);
  });

  it("missing movement and unusable quotes stay excluded", () => {
    expect(hasDisplayMovement(security(undefined), now)).toBe(false);
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -101]) expect(hasDisplayMovement(security(value), now)).toBe(false);
    for (const quality of [qualityFailure("stale", "staleObservation"), qualityFailure("unknown", "missingProvenance"), { status: "valid" as const, reasons: [], validUntilEpoch: 0 }]) {
      expect(hasDisplayMovement(security(2, { quoteQuality: quality }), now)).toBe(false);
    }
    expect(hasDisplayMovement(security(2, { isListed: false }), now)).toBe(false);
  });

  it("confirmed closing movement uses the displayed value", () => {
    const day = startOfDay(now);
    const asset = security(-2, {
      marketStatus: "closed",
      quoteTradingDate: day,
      closingPrice: { price: new Decimal(101), tradingDate: day, confirmedAt: now, percentageChange: new Decimal(1) },
    });
    expect(hasDisplayMovement(asset, now)).toBe(true);
    expect(text(displayPercentageChange(asset, now))).toBe("1");
    expect(movementIsAvailable(asset, now)).toBe(false);
  });

  it("the closing fallback requires the matching session and price", () => {
    const day = startOfDay(now);
    const close = { price: new Decimal(94_500), tradingDate: day, confirmedAt: now };
    const asset = security(-2, { marketStatus: "closed", quoteTradingDate: day, closingPrice: close });
    expect(hasDisplayMovement(asset, now)).toBe(true);
    expect(text(displayPercentageChange(asset, now))).toBe("-2");
    expect(displayPriceChange(asset, now)).toBeUndefined();
    expect(hasDisplayMovement({ ...asset, quoteTradingDate: day - DAY_MS }, now)).toBe(false);
    expect(hasDisplayMovement({ ...asset, closingPrice: { ...close, price: new Decimal(100) } }, now)).toBe(false);
  });

  it("closed-session movement survives midnight with a matching reference", () => {
    const friday = instant("2026-10-09T12:00:00Z");
    const saturday = instant("2026-10-10T00:18:00Z");
    let asset = security(2.95, {
      marketStatus: "closed",
      quoteTradingDate: friday,
      quoteQuality: { status: "valid", reasons: [], observedAt: startOfDay(friday), validUntilEpoch: saturday / 1000 + 120 },
      marketContextValidUntil: saturday + 3_600_000,
      referencePrice: {
        price: new Decimal(94_500),
        priceDate: friday,
        collectedAt: friday,
        sourceURL: "https://www.bodiva.ao/website/api/quotes",
        sourceHash: "a".repeat(64),
        parserVersion: "reference-v1",
      },
    });
    expect(hasSessionQuote(asset, saturday)).toBe(false);
    expect(hasUsableQuote(asset, saturday)).toBe(true);
    expect(usesReferenceDisplayPrice(asset, saturday)).toBe(false);
    expect(text(displayPercentageChange(asset, saturday))).toBe("2.95");
    expect(text(asset.volume)).toBe("83");

    asset = { ...asset, closingPrice: { price: asset.price, tradingDate: friday, confirmedAt: friday } };
    expect(text(displayPercentageChange(asset, saturday))).toBe("2.95");

    const expired = saturday + 120_000;
    expect(hasUsableQuote(asset, expired)).toBe(false);
    expect(usesReferenceDisplayPrice(asset, expired)).toBe(true);
    expect(displayPercentageChange(asset, expired)).toBeUndefined();
  });
});
