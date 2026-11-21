import { useTranslations } from "next-intl";

import { SignedInPageSkeleton } from "@/features/shell/placeholder-page";
import { CardSkeleton } from "@/ui/components/page-skeleton";
import { ChartShimmer, Skeleton } from "@/ui/components/states";

/** O simulador on its way: the title, the result beside the inputs from 1024 px (`Simulator`). */
export default function Loading() {
  const t = useTranslations();
  return (
    <SignedInPageSkeleton title={t("common.simulateInvestment")}>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-x-8">
        <CardSkeleton title={false} className="gap-4">
          <Skeleton className="h-12 w-56" />
          <ChartShimmer className="h-56" />
        </CardSkeleton>
        <CardSkeleton lines={5} />
      </div>
    </SignedInPageSkeleton>
  );
}
