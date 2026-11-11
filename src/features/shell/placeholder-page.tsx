import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { cn } from "@/ui/cn";
import { PageHeading } from "@/ui/components/layout";

export const SIGNED_IN_PAGE = "mx-auto w-full max-w-6xl px-4 pt-2 pb-16 sm:px-6 lg:pt-6";

type Params = { params: Promise<{ locale: string }> };

/** Title-only metadata for a signed-in page; never indexed. */
export const signedInMetadata =
  (titleKey: string) =>
  async ({ params }: Params): Promise<Metadata> => {
    const t = await getTranslations({ locale: (await params).locale as Locale });
    return { title: t(titleKey as never), robots: { index: false } };
  };

/** A signed-in destination whose content arrives in a later phase: its title, so navigation already works. */
export async function SignedInPage({ titleKey, children, className }: { titleKey: string; children?: ReactNode; className?: string }) {
  const t = await getTranslations();
  return (
    <main id="main" className={cn(SIGNED_IN_PAGE, "flex flex-col gap-8", className)}>
      <PageHeading title={t(titleKey as never)} />
      {children}
    </main>
  );
}
