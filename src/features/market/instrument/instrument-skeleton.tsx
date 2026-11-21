import { useTranslations } from "next-intl";

import { Card } from "@/ui/components/layout";
import { PageSkeleton } from "@/ui/components/page-skeleton";
import { ChartShimmer, Skeleton } from "@/ui/components/states";
import { Icon } from "@/ui/icons/icon";

/**
 * An instrument page on its way (template 3), inside the market layout's `<main>`: the sticky sidebar (identity,
 * price, key statistics) beside the tabs and the chart card, on the same grid as `InstrumentView`.
 */
export function InstrumentSkeleton() {
  const t = useTranslations();
  return (
    <PageSkeleton className="flex flex-col gap-6 lg:-mt-6 lg:grid lg:grid-cols-[19.5rem_minmax(0,1fr)] lg:items-start lg:gap-0">
      <div aria-hidden className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-(--top-bar-height) lg:-ml-3 lg:h-[calc(100dvh-var(--top-bar-height))] lg:border-r lg:border-hairline lg:py-6 lg:pr-6 lg:pl-3">
        <div className="flex flex-col gap-4">
          <span className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start px-2 text-secondary font-semibold text-accent">
            <Icon name="chevron-left" />
            {t("common.market")}
          </span>
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-3.5 w-36" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="flex min-w-0 flex-col gap-6 lg:py-6 lg:pl-6">
        <div className="flex min-h-12 items-center gap-6 border-b border-hairline desk:min-h-11">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-14" />
        </div>
        <Card className="flex flex-col gap-4">
          <Skeleton className="h-11 w-full rounded-medium sm:w-80" />
          <ChartShimmer className="h-[258px]" />
        </Card>
        <Card className="flex flex-col gap-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
      </div>
    </PageSkeleton>
  );
}
