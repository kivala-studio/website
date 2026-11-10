import type { Metadata } from "next";
import { cookies } from "next/headers";

import { DesignGallery } from "@/features/design-gallery/gallery";
import { parseTheme, THEME_COOKIE } from "@/ui/theme/theme";

// Development gallery: built only outside production mode (see pageExtensions in next.config.ts).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DesignPage() {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return <DesignGallery initialTheme={theme} />;
}
