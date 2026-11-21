import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { cn } from "@/ui/cn";
import { PageHeading, READING_COLUMN } from "@/ui/components/layout";

import { SIGNED_IN_PAGE } from "./route-skeletons";

export { SIGNED_IN_PAGE };

type Params = { params: Promise<{ locale: string }> };

/** Title-only metadata for a signed-in page; never indexed. */
export const signedInMetadata =
  (titleKey: string) =>
  async ({ params }: Params): Promise<Metadata> => {
    const t = await getTranslations({ locale: (await params).locale as Locale });
    return { title: t(titleKey as never), robots: { index: false } };
  };

/** A signed-in destination whose content arrives in a later phase: its title, so navigation already works. */
export async function SignedInPage({
  titleKey,
  narrow = false,
  children,
  className,
}: {
  titleKey: string;
  /** The centred reading column (settings, search) instead of the full container. */
  narrow?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const t = await getTranslations();
  return (
    <main id="main" className={SIGNED_IN_PAGE}>
      <div className={cn("flex flex-col gap-6", narrow ? READING_COLUMN : "w-full", className)}>
        <PageHeading title={t(titleKey as never)} />
        {children}
      </div>
    </main>
  );
}
