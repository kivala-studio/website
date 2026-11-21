import { useTranslations } from "next-intl";

import { cn } from "@/ui/cn";
import { Card } from "@/ui/components/layout";
import { CardSkeleton, PageSkeleton, TableSkeleton } from "@/ui/components/page-skeleton";
import { Skeleton } from "@/ui/components/states";

/** A stat tile's place (`StatTile`: the canvas inset in a card). */
function TileSkeleton({ large = false }: { large?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-medium bg-canvas px-4 py-3", large ? "min-h-28" : "min-h-20")}>
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className={large ? "mt-auto h-7 w-36" : "mt-auto h-5 w-20"} />
    </div>
  );
}

/**
 * `/mercado` on its way (template 2, the list page), inside the market layout's `<main>`: the centred title, the
 * three summary cards, the category tabs with the search, the count and the table.
 */
export function MarketOverviewSkeleton() {
  const t = useTranslations();
  return (
    <PageSkeleton className="flex flex-col gap-6 lg:gap-8">
      <h1 className="pt-2 text-center text-display text-primary-text lg:pt-4">{t("common.market")}</h1>
      <div aria-hidden className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CardSkeleton>
          <TileSkeleton large />
          <TileSkeleton />
        </CardSkeleton>
        <CardSkeleton>
          <div className="grid grid-cols-2 gap-3">
            <TileSkeleton />
            <TileSkeleton />
            <TileSkeleton />
            <TileSkeleton />
          </div>
        </CardSkeleton>
        <Card className="flex flex-col gap-3 md:col-span-2 xl:col-span-1">
          <Skeleton className="h-13 w-full rounded-medium desk:h-12" />
          <div className="flex flex-col divide-y divide-hairline">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="flex min-h-12 items-center gap-3 py-1.5 desk:min-h-11">
                <Skeleton className="size-8 shrink-0 rounded-full max-[25rem]:hidden" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="ml-auto h-4 w-20" />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div aria-hidden className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
          <div className="flex min-h-12 flex-1 items-center gap-6 overflow-hidden border-b border-hairline desk:min-h-11">
            {["w-12", "w-14", "w-24", "w-16", "w-20"].map((width) => (
              <Skeleton key={width} className={cn("h-4 shrink-0", width)} />
            ))}
          </div>
          <Skeleton className="h-12 w-full rounded-medium desk:h-11 lg:w-80 lg:shrink-0" />
        </div>
        <div className="flex min-h-11 items-center">
          <Skeleton className="h-3 w-16" />
        </div>
        <TableSkeleton rows={10} />
      </div>
    </PageSkeleton>
  );
}
