import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { cn } from "@/ui/cn";
import { PAGE_CONTAINER, PageHeading, READING_COLUMN } from "@/ui/components/layout";
import { CardSkeleton, PageHeadingSkeleton, PageSkeleton } from "@/ui/components/page-skeleton";

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

/**
 * A signed-in page on its way (its `loading.tsx`), in the app shell: the page column (`narrow`: the reading column),
 * the title row (`title`, or its place) with `actions` icon-button places and a `pill`, then `children` (two cards by
 * default).
 */
export function SignedInPageSkeleton({
  title,
  narrow = false,
  actions = 0,
  pill = false,
  className,
  children,
}: {
  title?: string;
  narrow?: boolean;
  actions?: number;
  pill?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <PageSkeleton as="main" className={SIGNED_IN_PAGE}>
      <div className={cn("flex flex-col gap-6", narrow ? READING_COLUMN : "w-full", className)}>
        <PageHeadingSkeleton title={title} actions={actions} pill={pill} />
        {children ?? (
          <>
            <CardSkeleton lines={4} />
            <CardSkeleton lines={2} />
          </>
        )}
      </div>
    </PageSkeleton>
  );
}
