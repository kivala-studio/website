import { type EpochMs, parseInstant } from "../market/zone";
import { type ContentExposureSnapshot, type PersonalizationCandidate, personalizationContext } from "./candidate";
import { type PersonalizationEvaluation, evaluatePersonalization } from "./engine";
import { interestProfile } from "./profile";
import { DISTANT_FUTURE, DISTANT_PAST } from "./storage";

/*
 * iOS `NotificationPersonalization`: consumes the server's rechecked significance and preferences decision, never a
 * movement derived in the browser.
 */

export type QualificationKind = "explicit_rule" | "verified_movement" | "approved_recap";

/** The `personalization` object the server attaches (`fact_key`, `checked_at`, `expires_at`). */
export interface NotificationQualification {
  readonly version: number;
  readonly kind: QualificationKind;
  readonly factKey: string;
  readonly checkedAt: string;
  readonly expiresAt: string;
}

export function decodeQualification(value: unknown): NotificationQualification | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const kinds: readonly string[] = ["explicit_rule", "verified_movement", "approved_recap"];
  if (!Number.isInteger(v.version) || typeof v.kind !== "string" || !kinds.includes(v.kind)) return null;
  if (typeof v.fact_key !== "string" || typeof v.checked_at !== "string" || typeof v.expires_at !== "string") return null;
  return { version: v.version as number, kind: v.kind as QualificationKind, factKey: v.fact_key, checkedAt: v.checked_at, expiresAt: v.expires_at };
}

export function evaluateNotification(
  qualification: NotificationQualification,
  securityID: string | null,
  exposure: ContentExposureSnapshot,
  now: EpochMs,
): PersonalizationEvaluation {
  const checked = parseInstant(qualification.checkedAt);
  const expires = parseInstant(qualification.expiresAt);
  const asset = securityID ?? (qualification.kind === "approved_recap" ? "subscription:market-recap" : "");
  const failure =
    qualification.version !== 1
      ? "unsupported-qualification-version"
      : qualification.factKey === ""
        ? "missing-qualification-fact"
        : asset === ""
          ? "missing-qualified-relationship"
          : checked === undefined || !(checked <= now)
            ? "missing-or-future-qualification-check"
            : expires === undefined || !(now < expires)
              ? "missing-or-expired-qualification"
              : !(expires - checked > 0 && expires - checked <= 120_000)
                ? "invalid-qualification-window"
                : null;
  // These explicit relationships have just passed the server's owner and preferences check.
  const profile =
    qualification.kind === "verified_movement" ? interestProfile({ watchedIDs: new Set([asset]) }) : interestProfile({ alertIDs: new Set([asset]) });
  const candidate: PersonalizationCandidate = {
    id: qualification.factKey,
    factKeys: new Set([qualification.factKey]),
    topicKeys: new Set(),
    assets: new Set([asset]),
    issuers: new Set(),
    family: qualification.kind,
    category: "notification",
    observedAt: checked ?? DISTANT_FUTURE,
    expiresAt: expires ?? DISTANT_PAST,
    significance: "material",
    rejection: failure === null ? null : "missing-or-expired-server-qualification",
  };
  return evaluatePersonalization([candidate], personalizationContext({ surface: "notification", now, profile, exposure }), 1);
}
