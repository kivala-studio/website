import { BUNDLED_CATALOGUE, type VoiceComposition, type VoiceContext, type VoiceReceipt, composeVoice } from "./voice";

/*
 * iOS `LocalProductVoice`: recent-choice memory per account. A rerender of the same source, revision and surface
 * returns the stored composition; new choices avoid recently used hook families. Only presentation history is kept,
 * in this browser, and nothing is uploaded.
 */

export interface VoiceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredReceipt {
  readonly key: string;
  readonly surface: string;
  /** Epoch milliseconds. */
  readonly createdAt: number;
  readonly composition: VoiceComposition;
}

const RECENT_MS = 14 * 86_400_000;
const PER_SURFACE = 20;

export const voiceStorageKey = (userID: string) => `investao.productVoice.${userID.toLowerCase()}.v1`;

function browserStorage(): VoiceStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function isReceipt(value: unknown): value is StoredReceipt {
  if (!isRecord(value) || !isRecord(value.composition)) return false;
  const { composition } = value;
  return (
    typeof value.key === "string" &&
    typeof value.surface === "string" &&
    typeof value.createdAt === "number" &&
    Number.isFinite(value.createdAt) &&
    ["catalogueVersion", "strategyId", "hookId", "hookFamily", "factClauseId", "title", "body", "accessibilityText", "privacyClass"].every(
      (key) => typeof composition[key] === "string",
    ) &&
    typeof composition.playful === "boolean"
  );
}

export class LocalProductVoice {
  private account: string | null = null;
  private receipts: StoredReceipt[] = [];

  constructor(private readonly storage: VoiceStorage | null = browserStorage()) {}

  /** Switches to an account (or none) and loads its stored receipts. */
  activate(userID: string | null): void {
    const account = userID?.toLowerCase() ?? null;
    if (this.account === account) return;
    this.account = account;
    this.receipts = [];
    if (!account || !this.storage) return;
    try {
      const stored: unknown = JSON.parse(this.storage.getItem(voiceStorageKey(account)) ?? "[]");
      if (Array.isArray(stored)) this.receipts = stored.filter(isReceipt);
    } catch {
      this.receipts = [];
    }
  }

  compose(context: VoiceContext, now: number = Date.now()): VoiceComposition {
    const account = this.account;
    if (!account) return composeVoice(context, { now });
    this.receipts = this.receipts.filter((receipt) => receipt.createdAt <= now && now - receipt.createdAt < RECENT_MS);
    const key = `${context.sourceKey}|${context.sourceRevision ?? 1}|${context.surface}|${BUNDLED_CATALOGUE?.catalogueVersion ?? "1.0.0"}`;
    const existing = this.receipts.find((receipt) => receipt.key === key);
    if (existing) return existing.composition;
    const history: VoiceReceipt[] = this.receipts
      .filter((receipt) => receipt.surface === context.surface)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((receipt) => ({ hookFamily: receipt.composition.hookFamily, playful: receipt.composition.playful, createdAt: receipt.createdAt }));
    const composition = composeVoice(context, { history, identity: account, now });
    this.receipts.unshift({ key, surface: context.surface, createdAt: now, composition });
    const counts = new Map<string, number>();
    this.receipts = this.receipts.filter((receipt) => {
      const count = (counts.get(receipt.surface) ?? 0) + 1;
      counts.set(receipt.surface, count);
      return count <= PER_SURFACE;
    });
    try {
      this.storage?.setItem(voiceStorageKey(account), JSON.stringify(this.receipts));
    } catch {
      // Keep the in-memory receipt when storage is full or blocked.
    }
    return composition;
  }

  /** Sign-out and account deletion: forget the account's receipts here and in storage. */
  remove(userID: string): void {
    const account = userID.toLowerCase();
    if (this.account === account) {
      this.account = null;
      this.receipts = [];
    }
    try {
      this.storage?.removeItem(voiceStorageKey(account));
    } catch {
      // Storage unavailable: nothing was persisted.
    }
  }
}
