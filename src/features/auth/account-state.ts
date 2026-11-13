"use client";

import { INTELLIGENCE_DATABASE } from "@/data/intelligence/database";
import { resetTabMarketStore } from "@/features/market/market-provider";

/**
 * Browser storage keys that hold one account's data start with this prefix; sign-out and session expiry remove
 * them. The account-setup draft (`investao.accountSetup.<id>.*`) is kept on purpose: setup resumes after the
 * person signs in again (iOS). Visitor state (theme, read lessons, a pending invite code) is not account data.
 */
export const ACCOUNT_STORAGE_PREFIX = "investao.account.";
/** The product voice's per-account receipts (iOS keeps them in `UserDefaults` under the same name). */
const VOICE_STORAGE_PREFIX = "investao.productVoice.";

function clearStorage(storage: () => Storage) {
  try {
    const store = storage();
    for (const key of Object.keys(store)) if (key.startsWith(ACCOUNT_STORAGE_PREFIX) || key.startsWith(VOICE_STORAGE_PREFIX)) store.removeItem(key);
  } catch {
    // Unavailable storage holds nothing to clear.
  }
}

/**
 * Forgets the tab's account state: market store, account-scoped storage (personalisation included) and the weekly
 * reading's database. The page then leaves (full navigation), which closes the database so its deletion completes.
 */
export function clearAccountState(): void {
  resetTabMarketStore();
  clearStorage(() => window.localStorage);
  clearStorage(() => window.sessionStorage);
  try {
    indexedDB.deleteDatabase(INTELLIGENCE_DATABASE);
  } catch {
    // Unavailable storage holds nothing to clear.
  }
}
