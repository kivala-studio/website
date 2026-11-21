import { useTranslations } from "next-intl";

import { cn } from "@/ui/cn";
import { READING_COLUMN } from "@/ui/components/layout";
import { CardSkeleton, PageSkeleton, TitleSkeleton } from "@/ui/components/page-skeleton";
import { Skeleton } from "@/ui/components/states";
import { Icon } from "@/ui/icons/icon";

/** A new admission on its way: the way back, the issuer's logo and name, then the admission's cards. */
export default function Loading() {
  const t = useTranslations();
  return (
    <PageSkeleton className={cn(READING_COLUMN, "gap-6")}>
      <span aria-hidden className="-mb-2 -ml-1 inline-flex min-h-11 items-center gap-1 self-start px-1 text-secondary font-semibold text-accent">
        <Icon name="chevron-left" />
        {t("common.market")}
      </span>
      <div aria-hidden className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full desk:size-12" />
        <div className="flex min-w-0 flex-col gap-1">
          <TitleSkeleton />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <CardSkeleton lines={3} />
      <CardSkeleton lines={2} />
    </PageSkeleton>
  );
}
