import { useTranslations } from "next-intl";

import { Card } from "@/ui/components/layout";
import { InstrumentRowSkeleton, Skeleton } from "@/ui/components/states";

/** The value card and the positions while the ledger loads; also the portfolio routes' skeleton. */
export function DashboardSkeleton() {
  const t = useTranslations();
  return (
    <div role="status" aria-label={t("portfolio.header.loading")} className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-45 w-full" />
      </Card>
      <Card className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        {[0, 1, 2, 3].map((index) => (
          <InstrumentRowSkeleton key={index} />
        ))}
      </Card>
    </div>
  );
}
