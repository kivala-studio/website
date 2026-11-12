"use client";

/**
 * Whether privacy mode hides personal values in this browser. Phase W10 adds the preference and its toggle;
 * until then it is off, and every masking call site (alerts, the Activity centre) already reads it here.
 */
export function usePrivacyMode(): boolean {
  return false;
}
