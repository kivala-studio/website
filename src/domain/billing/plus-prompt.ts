import type { SubscriptionAccess } from "../account/access";

import type { WebPlan } from "./web-pass";

/*
 * The Plus prompt on Home: an offer to an account that limits apply to, or a reminder that a prepaid Plus ends soon.
 * Never for an App Store subscriber (the store renews it) or lifetime Plus, and only while passes are on sale.
 */

export type PlusPrompt = "offer" | "renew";

const DAY_MS = 24 * 60 * 60_000;

/** Plus that ends within this window from now asks to be renewed. */
export const PLUS_RENEW_WINDOW_MS = 7 * DAY_MS;
/** A dismissed offer stays away this long. */
export const PLUS_OFFER_SNOOZE_MS = 30 * DAY_MS;

/** What this browser remembers for one account. */
export interface PlusPromptDismissal {
  /** When the offer was last dismissed (epoch milliseconds). */
  readonly offerAt: number | null;
  /** `plusEndKey` of the Plus end date whose renew prompt was dismissed: a later pass prompts again. */
  readonly renewKey: string | null;
}

export const NO_PLUS_PROMPT_DISMISSAL: PlusPromptDismissal = { offerAt: null, renewKey: null };

/** An opaque key for a Plus end date (FNV-1a), so the date itself is never stored. */
export function plusEndKey(plusUntil: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < plusUntil.length; index++) {
    hash ^= plusUntil.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * The prompt the access document alone allows, before the plans are known: decides whether the plans are worth
 * reading at all. Null while access or the dismissal is unknown.
 */
export function plusPromptCandidate(access: SubscriptionAccess | null, now: number, dismissal: PlusPromptDismissal | null): PlusPrompt | null {
  if (!access || !dismissal) return null;
  if (!access.isPlus) {
    if (!access.enforcementEnabled) return null;
    return dismissal.offerAt !== null && now - dismissal.offerAt < PLUS_OFFER_SNOOZE_MS ? null : "offer";
  }
  // Only prepaid Plus ends without the store renewing it; lifetime Plus has no end date.
  if (access.storeSubscription !== false || access.plusUntil === null) return null;
  const left = Date.parse(access.plusUntil) - now;
  if (!(left > 0 && left <= PLUS_RENEW_WINDOW_MS)) return null;
  return dismissal.renewKey === plusEndKey(access.plusUntil) ? null : "renew";
}

/** The prompt to show: the candidate, once the server has passes on sale (`plans` null: not read or failed). */
export function plusPrompt(
  access: SubscriptionAccess | null,
  plans: readonly WebPlan[] | null,
  now: number,
  dismissal: PlusPromptDismissal | null,
): PlusPrompt | null {
  return plans && plans.length > 0 ? plusPromptCandidate(access, now, dismissal) : null;
}

/** The dismissal after `prompt` was dismissed at `now`. */
export function dismissPlusPrompt(dismissal: PlusPromptDismissal, prompt: PlusPrompt, access: SubscriptionAccess, now: number): PlusPromptDismissal {
  if (prompt === "offer") return { ...dismissal, offerAt: now };
  return access.plusUntil === null ? dismissal : { ...dismissal, renewKey: plusEndKey(access.plusUntil) };
}

/** The stored value; anything missing or damaged reads as nothing dismissed. */
export function decodePlusPromptDismissal(raw: string | null): PlusPromptDismissal {
  if (!raw) return NO_PLUS_PROMPT_DISMISSAL;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return NO_PLUS_PROMPT_DISMISSAL;
    const { offerAt, renewKey } = value as Record<string, unknown>;
    return {
      offerAt: typeof offerAt === "number" && Number.isFinite(offerAt) ? offerAt : null,
      renewKey: typeof renewKey === "string" && renewKey !== "" ? renewKey : null,
    };
  } catch {
    return NO_PLUS_PROMPT_DISMISSAL;
  }
}

export const encodePlusPromptDismissal = (dismissal: PlusPromptDismissal) => JSON.stringify(dismissal);
