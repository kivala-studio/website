import "server-only";

import type { Locale } from "next-intl";

import { hosts } from "@/config/server-env";
import { getPathname } from "@/i18n/navigation";

/** A signed-in page's link from the site: on the app's own host when it has one, else the localised path. */
export function appHref(path: string, locale: Locale): string {
  const localised = getPathname({ locale, href: path });
  return hosts ? `${hosts.appOrigin}${localised}` : localised;
}
