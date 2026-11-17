import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { cn } from "@/ui/cn";
import { PAGE_CONTAINER, PageHeading } from "@/ui/components/layout";

/** A signed-in page's `<main>`: the shared page column with the app's top and bottom spacing. */
export const SIGNED_IN_PAGE = cn(PAGE_CONTAINER, "pt-4 pb-16 lg:pt-8");

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
