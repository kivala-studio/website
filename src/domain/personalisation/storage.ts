/*
 * Browser persistence for personalisation. Keys start with the account prefix, so sign-out and session expiry remove
 * them with the rest of the account's storage (`clearAccountState`). Storage can be unavailable (private mode,
 * quota): every access is guarded and failure means "nothing stored".
 */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length?: number;
  key?(index: number): string | null;
}

export const PERSONALISATION_PREFIX = "investao.account.personalisation.";
export const EXPOSURE_PREFIX = "investao.account.exposure.";

/** Foundation `Date.distantPast` (0001-01-01) and `Date.distantFuture` (4001-01-01). */
export const DISTANT_PAST = -62_135_596_800_000;
export const DISTANT_FUTURE = 64_092_211_200_000;

export function readJSON(storage: KeyValueStorage, key: string): unknown {
  try {
    const value = storage.getItem(key);
    return value === null ? undefined : (JSON.parse(value) as unknown);
  } catch {
    return undefined;
  }
}

export function writeJSON(storage: KeyValueStorage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Local suppression remains in memory until storage can be written.
  }
}

export function removeKey(storage: KeyValueStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Unavailable storage holds nothing to remove.
  }
}

/** An in-memory storage (tests, and browsers that refuse `localStorage`). */
export function memoryStorage(): KeyValueStorage & { readonly values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
  };
}

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
export const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
export const stringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

export function dateRecord(value: unknown): Map<string, number> {
  const result = new Map<string, number>();
  if (!isRecord(value)) return result;
  for (const [key, date] of Object.entries(value)) if (isFiniteNumber(date)) result.set(key, date);
  return result;
}
