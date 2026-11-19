import { publicEnv } from "@/config/public-env";
import { issuerLogoPath } from "@/domain/market/logo";

/**
 * The logo every view renders for an issuer: the same-origin route, which answers 404 when the issuer has no
 * curated logo, no website or no usable icon (the monogram shows). Demo mode has no network, so no logo.
 */
export const issuerLogoURL = (issuerID: string | undefined): string | undefined =>
  publicEnv.dataMode === "demo" ? undefined : issuerLogoPath(issuerID);
