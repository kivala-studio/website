import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import pt from "../../../messages/pt.json";
import { createFormat } from "../format";
import { Dec } from "../intelligence/math";
import type { Insight } from "../intelligence/models";
import {
  BUNDLED_CATALOGUE,
  FALLBACK_COMPOSITION,
  LocalProductVoice,
  TEMPLATE_KEYS,
  type VoiceComposition,
  type VoiceContext,
  type VoiceStorage,
  composeVoice,
  insightVoiceContext,
  localizeComposition,
  voiceHash,
  voiceStorageKey,
} from ".";

const root = join(__dirname, "../../..");
const read = (path: string) => readFileSync(join(root, path));

interface Fixture {
  readonly context: VoiceContext;
  readonly history: readonly { hookFamily: string; playful: boolean; createdAt: string }[];
  readonly identity: string;
  readonly now: string;
  readonly expected: VoiceComposition;
}

const tEn = createTranslator({ locale: "en", messages: en }) as unknown as (key: string, values?: Record<string, string>) => string;
const tPt = createTranslator({ locale: "pt", messages: pt }) as unknown as (key: string, values?: Record<string, string>) => string;

class MemoryStorage implements VoiceStorage {
  readonly items = new Map<string, string>();
  getItem = (key: string) => this.items.get(key) ?? null;
  setItem = (key: string, value: string) => void this.items.set(key, value);
  removeItem = (key: string) => void this.items.delete(key);
}

describe("product voice catalogue", () => {
  it("is a byte-identical copy of the reviewed catalogue", () => {
    const copy = read("src/domain/product-voice/catalogue.v1.json");
    expect(copy.equals(read("tests/fixtures/catalogue.v1.json"))).toBe(true);
    const digest = createHash("sha256").update(copy).digest("hex");
    expect(digest).toBe(read("tests/fixtures/catalogue.v1.sha256").toString("utf8").trim());
    expect(BUNDLED_CATALOGUE?.catalogueVersion).toBe("1.0.0");
  });

  it("names a message for every template, and the Portuguese message is the catalogue text", () => {
    const components = [...BUNDLED_CATALOGUE!.hooks, ...BUNDLED_CATALOGUE!.factClauses].filter((item) => item.text !== "{publicationTitle}");
    for (const item of components) {
      const tokens = Object.fromEntries([...item.text.matchAll(/\{([^}]+)\}/g)].map((match) => [match[1], `{${match[1]}}`]));
      expect(TEMPLATE_KEYS[item.id], item.id).toBeDefined();
      expect(tPt(TEMPLATE_KEYS[item.id], tokens)).toBe(item.text);
    }
  });
});

describe("composition", () => {
  it("matches every cross-runtime parity fixture", () => {
    const fixtures = JSON.parse(read("tests/fixtures/parity.v1.json").toString("utf8")) as Fixture[];
    expect(fixtures).toHaveLength(20);
    for (const fixture of fixtures) {
      const history = fixture.history.map((receipt) => ({ ...receipt, createdAt: Date.parse(receipt.createdAt) }));
      expect(composeVoice(fixture.context, { history, identity: fixture.identity, now: Date.parse(fixture.now) }), fixture.context.sourceKey).toEqual(
        fixture.expected,
      );
    }
  });

  it("falls back without a catalogue and hashes with FNV-1a", () => {
    expect(composeVoice({ eventFamily: "movement", surface: "push", sourceKey: "x", verifiedFacts: {}, capabilities: [] }, { catalogue: null })).toEqual(
      FALLBACK_COMPOSITION,
    );
    expect(voiceHash("")).toBe(2166136261);
    expect(voiceHash("a")).toBe(0xe40c292c);
  });
});

describe("recent-choice memory", () => {
  it("keeps receipts stable, per account, and forgets them on removal", () => {
    const storage = new MemoryStorage();
    const account = "6F9619FF-8B86-D011-B42D-00C04FC964FF";
    const context: VoiceContext = {
      eventFamily: "listing",
      surface: "listing",
      sourceKey: "listing",
      mood: "celebratory",
      verifiedFacts: { issuer: "BAI" },
      capabilities: ["confirmed_listing"],
    };
    const store = new LocalProductVoice(storage);
    store.activate(account);
    const first = store.compose(context);
    expect(store.compose(context)).toEqual(first);
    const restored = new LocalProductVoice(storage);
    restored.activate(account);
    expect(restored.compose(context)).toEqual(first);
    expect(storage.getItem(voiceStorageKey(account))).toContain("hookFamily");
    restored.remove(account);
    expect(storage.getItem(voiceStorageKey(account))).toBeNull();
  });
});

describe("localisation", () => {
  it("renders a stored composition again in English and leaves Portuguese unchanged", () => {
    const fixture = (JSON.parse(read("tests/fixtures/parity.v1.json").toString("utf8")) as Fixture[])[0];
    expect(localizeComposition(fixture.expected, "pt", tPt)).toBe(fixture.expected);
    const english = localizeComposition(fixture.expected, "en", tEn);
    expect(english.title).toBe("BAI is moving");
    expect(english.body).toBe("BAI: +4,2% versus the previous close.");
    expect(english.accessibilityText).toBe("BAI is moving. BAI: +4,2% versus the previous close.");
    expect(localizeComposition(FALLBACK_COMPOSITION, "en", tEn).title).toBe("New information in invest.ao");
  });
});

describe("insight adapter", () => {
  const day = Date.UTC(2026, 8, 21);
  const insight = (percentage: string): Insight => ({
    id: "price-change:BAI",
    type: "assetPriceChange",
    category: "watchlist",
    fact: {
      kind: "priceChange",
      value: {
        assetID: "BAI",
        currencyCode: "AOA",
        startPrice: new Dec(100),
        endPrice: new Dec(100).plus(percentage),
        percentageChange: new Dec(percentage),
        firstObservedAt: day,
        lastObservedAt: day + 4 * 86_400_000,
      },
    },
    generatedAt: day + 5 * 86_400_000,
    period: { start: day, endExclusive: day + 5 * 86_400_000 },
    expiresAt: day + 12 * 86_400_000,
    relatedAssetIDs: ["BAI"],
    relevance: { isHeld: false, isWatched: true, activityRank: null },
    destination: { kind: "asset", assetID: "BAI" },
    provenance: { calculationID: "c", calculationVersion: 1, calendarVersion: "v", observations: [], fetchedAt: day, completeness: "completeExpectedSessions" },
  });
  const options = { symbols: { BAI: "BAI" }, surface: "watchlist", format: createFormat("pt", tPt), t: tPt };

  it("maps a verified movement and revises only when the evidence changes", () => {
    const context = insightVoiceContext(insight("4.2"), options)!;
    expect(context).toMatchObject({
      eventFamily: "movement",
      direction: "up",
      significance: "significant",
      mood: "energetic",
      privacyClass: "personal_context",
    });
    expect(context.verifiedFacts.signedPercentage).toBe("+4,2");
    expect(context.verifiedFacts.comparisonLabel.startsWith("entre os fechos verificados de ")).toBe(true);
    expect(insightVoiceContext(insight("4.2"), options)!.sourceRevision).toBe(context.sourceRevision);
    expect(insightVoiceContext(insight("4.3"), options)!.sourceRevision).not.toBe(context.sourceRevision);
    expect(composeVoice(context).strategyId).toBe("movement");
  });
});
