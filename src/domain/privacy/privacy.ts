/*
 * Privacy mode (iOS `docs/privacy-mode.md`): a per-browser preference, off by default, kept across sign-out and
 * account changes. It lives in a cookie so the server renders hidden values hidden: nothing flashes on load.
 */

export const PRIVACY_COOKIE = "investao-privacy";
const ENABLED = "on";
/** Six dots, the width of most values; the layout keeps the real value's footprint. */
export const PRIVACY_MASK = "••••••";

export const parsePrivacyMode = (value: string | undefined) => value === ENABLED;

/** The cookie string a browser writes; one year, every path, never sent cross-site. */
export function privacyCookie(enabled: boolean, secure: boolean): string {
  const attributes = `path=/; samesite=lax${secure ? "; secure" : ""}`;
  return enabled ? `${PRIVACY_COOKIE}=${ENABLED}; max-age=31536000; ${attributes}` : `${PRIVACY_COOKIE}=; max-age=0; ${attributes}`;
}

/** Rows that could reveal position size by their order sort by instrument id while values are hidden. */
export function orderWhileHidden<T extends { readonly id: string }>(items: readonly T[], hidden: boolean): readonly T[] {
  if (!hidden) return items;
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
