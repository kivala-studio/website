import { useTranslations } from "next-intl";

import { SignedInPageSkeleton } from "@/features/shell/placeholder-page";
import { Card } from "@/ui/components/layout";
import { PanelSkeleton, RowsSkeleton } from "@/ui/components/page-skeleton";
import { Skeleton } from "@/ui/components/states";

/** Início on its way: the title and refresh, the overview card and the movers beside the watchlist and the news (`HomeView`). */
export default function Loading() {
  const t = useTranslations();
  return (
    <SignedInPageSkeleton title={t("common.home")} actions={1}>
      <div aria-hidden className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
          <Card className="flex flex-col gap-5 max-lg:order-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-11 w-full" />
          </Card>
          <PanelSkeleton className="max-lg:order-3">
            <Skeleton className="h-11 w-full rounded-medium" />
            <RowsSkeleton rows={3} />
          </PanelSkeleton>
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-6">
          <PanelSkeleton className="max-lg:order-2">
            <RowsSkeleton rows={3} />
          </PanelSkeleton>
          <PanelSkeleton className="max-lg:order-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </PanelSkeleton>
        </div>
      </div>
    </SignedInPageSkeleton>
  );
}
