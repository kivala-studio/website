"use client";

import { resetTabMarketStore } from "@/features/market/market-provider";

/**
 * Browser storage keys that hold one account's data start with this prefix; sign-out and session expiry remove
 * them. The account-setup draft (`investao.accountSetup.<id>.*`) is kept on purpose: setup resumes after the
 * person signs in again (iOS). Visitor state (theme, read lessons, a pending invite code) is not account data.
 */
export const ACCOUNT_STORAGE_PREFIX = "investao.account.";

function clearStorage(storage: () => Storage) {
  try {
    const store = storage();
    for (const key of Object.keys(store)) if (key.startsWith(ACCOUNT_STORAGE_PREFIX)) store.removeItem(key);
  } catch {
    // Unavailable storage holds nothing to clear.
  }
}

/** Forgets the tab's account state: market store and account-scoped storage. The page then leaves (full navigation). */
export function clearAccountState(): void {
  resetTabMarketStore();
  clearStorage(() => window.localStorage);
  clearStorage(() => window.sessionStorage);
}
