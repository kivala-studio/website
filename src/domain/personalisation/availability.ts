import type { InsightType } from "../intelligence/models";
import type { EpochMs } from "../market/zone";

/*
 * The slice of iOS `IntelligenceAvailability` the personalisation engine reads. The feature-control store installs the
 * resolved availability with `setPersonalizationAvailability`; until then the local safe defaults apply
 * (engine on, v2 off, personalised Home on, every insight family permitted).
 */

export type PersonalizationVersion = "significance" | "v1" | "v2";

export interface PersonalizationAvailability {
  readonly personalizationVersion: PersonalizationVersion;
  /** `personalized_home`. */
  readonly personalizedHome: boolean;
  readonly permits: (type: InsightType) => boolean;
}

export const LOCAL_DEFAULT_AVAILABILITY: PersonalizationAvailability = { personalizationVersion: "v1", personalizedHome: true, permits: () => true };

let provider: (now: EpochMs) => PersonalizationAvailability = () => LOCAL_DEFAULT_AVAILABILITY;

export function setPersonalizationAvailability(next: ((now: EpochMs) => PersonalizationAvailability) | null): void {
  provider = next ?? (() => LOCAL_DEFAULT_AVAILABILITY);
}

export const personalizationAvailability = (now: EpochMs) => provider(now);
