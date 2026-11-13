import bundledJSON from "./catalogue.v1.json";

/*
 * iOS `ProductVoice.swift`: the reviewed catalogue and its deterministic composition. The catalogue file is a
 * byte-identical copy of `tests/fixtures/catalogue.v1.json` (checked against its sha256 in the tests) and is only
 * imported by signed-in code.
 */

export interface VoiceComposition {
  readonly catalogueVersion: string;
  readonly strategyId: string;
  readonly hookId: string;
  readonly hookFamily: string;
  readonly factClauseId: string;
  readonly closerId: string | null;
  readonly title: string;
  readonly body: string;
  readonly accessibilityText: string;
  readonly privacyClass: string;
  readonly playful: boolean;
}

export interface VoiceContext {
  readonly eventFamily: string;
  readonly surface: string;
  readonly sourceKey: string;
  /** Default 1. */
  readonly sourceRevision?: number;
  /** Default `notable`. */
  readonly significance?: string;
  /** Default `neutral`. */
  readonly direction?: string;
  /** Default `curious`. */
  readonly mood?: string;
  /** Default `public_market`. */
  readonly privacyClass?: string;
  readonly verifiedFacts: Readonly<Record<string, string>>;
  readonly capabilities: readonly string[];
}

export interface VoiceReceipt {
  readonly hookFamily: string;
  readonly playful: boolean;
  /** Epoch milliseconds. */
  readonly createdAt: number;
}

export interface CatalogueComponent {
  readonly id: string;
  readonly text: string;
  readonly eventFamilies: readonly string[];
  readonly surfaces: readonly string[];
  readonly directions: readonly string[];
  readonly significanceLevels: readonly string[];
  readonly moods: readonly string[];
  readonly requiredCapabilities: readonly string[];
  readonly privacyClass: string;
  readonly playful: boolean;
  readonly hookFamily: string;
}

export interface ProductVoiceCatalogue {
  readonly schemaVersion: number;
  readonly catalogueVersion: string;
  readonly locale: string;
  readonly hooks: readonly CatalogueComponent[];
  readonly factClauses: readonly CatalogueComponent[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");

function component(value: unknown): CatalogueComponent | null {
  if (!isRecord(value)) return null;
  const { id, text, privacyClass, playful, hookFamily } = value;
  const lists = ["eventFamilies", "surfaces", "directions", "significanceLevels", "moods", "requiredCapabilities"] as const;
  if (typeof id !== "string" || typeof text !== "string" || typeof privacyClass !== "string" || typeof playful !== "boolean" || typeof hookFamily !== "string")
    return null;
  if (!lists.every((key) => isStrings(value[key]))) return null;
  return value as unknown as CatalogueComponent;
}

/** Decodes a catalogue; only schema 1 in pt-AO is accepted, as on iOS. */
export function parseCatalogue(value: unknown): ProductVoiceCatalogue | null {
  if (!isRecord(value)) return null;
  const { schemaVersion, catalogueVersion, locale, hooks, factClauses } = value;
  if (schemaVersion !== 1 || locale !== "pt-AO" || typeof catalogueVersion !== "string") return null;
  if (!Array.isArray(hooks) || !Array.isArray(factClauses)) return null;
  const parsedHooks = hooks.map(component);
  const parsedClauses = factClauses.map(component);
  if (parsedHooks.includes(null) || parsedClauses.includes(null)) return null;
  return { schemaVersion, catalogueVersion, locale, hooks: parsedHooks as CatalogueComponent[], factClauses: parsedClauses as CatalogueComponent[] };
}

export const BUNDLED_CATALOGUE: ProductVoiceCatalogue | null = parseCatalogue(bundledJSON);

export const FALLBACK_COMPOSITION: VoiceComposition = {
  catalogueVersion: "1.0.0",
  strategyId: "fallback",
  hookId: "safe-generic",
  hookFamily: "safe-generic",
  factClauseId: "safe-generic",
  closerId: null,
  title: "Nova informação em invest.ao",
  body: "Abra a aplicação para consultar a atualização.",
  accessibilityText: "Nova informação em invest.ao. Abra a aplicação para consultar a atualização.",
  privacyClass: "public_market",
  playful: false,
};

const encoder = new TextEncoder();

/** 32-bit FNV-1a over UTF-8 bytes. */
export function voiceHash(value: string): number {
  let hash = 2166136261;
  for (const byte of encoder.encode(value)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash >>> 0;
}

export function voiceMood(family: string, direction: string, significance: string): string {
  if (direction === "down") return "cautious";
  if (family === "listing") return "celebratory";
  if (significance === "routine") return "calm";
  return direction === "up" && ["significant", "exceptional"].includes(significance) ? "energetic" : "curious";
}

const RECENT_MS = 14 * 86_400_000;
const PRIVACY: Readonly<Record<string, number>> = { public_market: 0, personal_context: 1, private_financial: 2 };
const TOKENS = new Set([
  "issuer",
  "symbol",
  "signedPercentage",
  "comparisonLabel",
  "observationTime",
  "referencePrice",
  "referencePeriod",
  "rising",
  "falling",
  "unchanged",
  "sessions",
  "directionLabel",
  "extremeLabel",
  "publicationTitle",
]);
const TOKEN = /\{([^}]+)\}/g;
const UNSAFE = /[\r\n{}]/;

function interpolate(template: string, facts: Readonly<Record<string, string>>): string | null {
  let failed = false;
  const result = template.replace(TOKEN, (_, token: string) => {
    const value = Object.hasOwn(facts, token) ? facts[token] : undefined;
    if (!TOKENS.has(token) || value === undefined || UNSAFE.test(value)) {
      failed = true;
      return "";
    }
    return value;
  });
  return failed ? null : result;
}

const scalars = (value: string) => [...value].length;
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export interface ComposeOptions {
  readonly history?: readonly VoiceReceipt[];
  readonly identity?: string;
  readonly now?: number;
  readonly catalogue?: ProductVoiceCatalogue | null;
}

/** Same context, history, identity and time → same composition. Anything that cannot be rendered safely falls back. */
export function composeVoice(context: VoiceContext, options: ComposeOptions = {}): VoiceComposition {
  const catalogue = options.catalogue === undefined ? BUNDLED_CATALOGUE : options.catalogue;
  if (!catalogue) return FALLBACK_COMPOSITION;
  const now = options.now ?? Date.now();
  const identity = options.identity ?? "";
  const direction = context.direction ?? "neutral";
  const significance = context.significance ?? "notable";
  const mood = context.mood ?? "curious";
  const privacyClass = context.privacyClass ?? "public_market";
  const recent = (options.history ?? []).filter((receipt) => receipt.createdAt <= now && now - receipt.createdAt < RECENT_MS).slice(0, 10);

  const compatible = (item: CatalogueComponent) =>
    item.eventFamilies.includes(context.eventFamily) &&
    item.surfaces.includes(context.surface) &&
    item.directions.includes(direction) &&
    item.significanceLevels.includes(significance) &&
    item.moods.includes(mood) &&
    item.requiredCapabilities.every((capability) => context.capabilities.includes(capability)) &&
    (PRIVACY[item.privacyClass] ?? 99) <= (PRIVACY[privacyClass] ?? -1) &&
    (context.surface !== "push" || item.privacyClass === "public_market");

  const score = (hook: CatalogueComponent): readonly [number, number, number] => {
    const uses = recent.filter((receipt) => receipt.hookFamily === hook.hookFamily);
    return [uses.length, uses[0]?.createdAt ?? 0, voiceHash(`${identity}|${context.sourceKey}|${catalogue.catalogueVersion}|${hook.id}`)];
  };

  const playfulRecently = recent.slice(0, 5).filter((receipt) => receipt.playful).length;
  const hooks = catalogue.hooks
    .filter(compatible)
    .filter((hook) => !hook.playful || playfulRecently < 2)
    .map((hook) => ({ hook, score: score(hook) }))
    .sort((a, b) => a.score[0] - b.score[0] || a.score[1] - b.score[1] || a.score[2] - b.score[2] || compareText(a.hook.id, b.hook.id))
    .map(({ hook }) => hook);
  const clauses = catalogue.factClauses
    .filter(compatible)
    .sort((a, b) => b.requiredCapabilities.length - a.requiredCapabilities.length || compareText(a.id, b.id));

  for (const hook of hooks) {
    for (const clause of clauses) {
      const title = interpolate(hook.text, context.verifiedFacts);
      const body = interpolate(clause.text, context.verifiedFacts);
      if (title === null || body === null || scalars(title) > 100 || scalars(body) > 250) continue;
      return {
        catalogueVersion: catalogue.catalogueVersion,
        strategyId: context.eventFamily,
        hookId: hook.id,
        hookFamily: hook.hookFamily,
        factClauseId: clause.id,
        closerId: null,
        title,
        body,
        accessibilityText: `${title}. ${body}`,
        privacyClass,
        playful: hook.playful,
      };
    }
  }
  return FALLBACK_COMPOSITION;
}
