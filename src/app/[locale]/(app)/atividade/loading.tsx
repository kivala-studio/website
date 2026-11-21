import { useTranslations } from "next-intl";

import { SignedInPageSkeleton } from "@/features/shell/placeholder-page";
import { Card } from "@/ui/components/layout";
import { Skeleton } from "@/ui/components/states";

/** Atividade on its way: the title and its actions, the filter tabs and the list (`ActivityCenter`). */
export default function Loading() {
  const t = useTranslations();
  return (
    <SignedInPageSkeleton title={t("common.activity")} actions={2} pill narrow className="gap-4">
      <div aria-hidden className="flex min-h-12 items-center gap-6 border-b border-hairline desk:min-h-11">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Card flush aria-hidden className="flex flex-col divide-y divide-hairline px-5 desk:px-6">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="flex flex-col gap-2 py-4">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </Card>
    </SignedInPageSkeleton>
  );
}
