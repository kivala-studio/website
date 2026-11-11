/** Auth `user_metadata` keys the apps share (iOS `AuthenticationStore`). */
export const ACCOUNT_METADATA = {
  displayName: "investao_display_name",
  nameSkipped: "investao_name_skipped",
  setupCompleted: "investao_onboarding_completed",
} as const;

export type UserMetadata = Readonly<Record<string, unknown>>;

/**
 * The name the account prefers: the saved display name, then the provider's `full_name`, then `name`.
 * A skipped name step hides the provider names but never a name the person saved.
 */
export function preferredName(metadata: UserMetadata | null | undefined): string | null {
  if (!metadata) return null;
  for (const key of [ACCOUNT_METADATA.displayName, "full_name", "name"]) {
    if (key !== ACCOUNT_METADATA.displayName && metadata[ACCOUNT_METADATA.nameSkipped] === true) return null;
    const value = metadata[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

/** First letters of the first and last words, upper case; `I` without a name (iOS Home profile button). */
export function profileInitials(displayName: string): string {
  const words = displayName.split(/\s+/u).filter(Boolean);
  const first = words[0] ? Array.from(words[0])[0] : undefined;
  if (!first) return "I";
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
  return `${first}${last}`.toLocaleUpperCase("pt");
}

/** Server completion flag: `true`, `false` (enrolled, not finished) or absent. */
export function setupCompletion(metadata: UserMetadata | null | undefined): boolean | null {
  const value = metadata?.[ACCOUNT_METADATA.setupCompleted];
  return typeof value === "boolean" ? value : null;
}

/**
 * Accounts created before this instant without a completion flag skip setup, as iOS installations do for
 * accounts older than their rollout date. iOS enrols every account it creates, so this only decides for
 * accounts whose first sign-in is on the web.
 */
export const WEB_ACCOUNT_SETUP_ROLLOUT = Date.UTC(2026, 10, 11);

/** iOS `PostLoginOnboardingPersistence.needsSetup`. */
export function needsAccountSetup(input: {
  createdAt: number;
  serverCompletion: boolean | null;
  hasDraft: boolean;
  locallyCompleted: boolean;
  rolloutAt?: number;
}): boolean {
  if (input.serverCompletion === true || input.locallyCompleted) return false;
  if (input.hasDraft || input.serverCompletion === false) return true;
  return input.createdAt >= (input.rolloutAt ?? WEB_ACCOUNT_SETUP_ROLLOUT);
}
