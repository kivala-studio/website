import { useTranslations } from "next-intl";

import { SIGNED_IN_PAGE } from "@/features/shell/placeholder-page";
import { cn } from "@/ui/cn";
import { PageSkeleton, TableSkeleton } from "@/ui/components/page-skeleton";
import { Skeleton } from "@/ui/components/states";

/**
 * A tua lista on its way (`WatchlistView`): the title over the count, refresh and groups, the add button (full width
 * on phones), the plan line, then the table.
 */
export default function Loading() {
  const t = useTranslations();
  return (
    <PageSkeleton as="main" className={cn(SIGNED_IN_PAGE, "flex flex-col gap-4")}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-display text-primary-text">{t("common.yourWatchlist")}</h1>
          <span aria-hidden className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-36" />
          </span>
        </div>
        <div aria-hidden className="flex items-center gap-2">
          <Skeleton className="size-12 rounded-full desk:size-11" />
          <Skeleton className="h-11 w-20 rounded-full" />
        </div>
        <Skeleton className="h-14 w-full rounded-full sm:w-56 desk:h-11" />
      </div>
      <span aria-hidden className="flex h-5 items-center">
        <Skeleton className="h-3.5 w-56" />
      </span>
      <TableSkeleton rows={4} />
    </PageSkeleton>
  );
}
