import { useTranslations } from "next-intl";

import { ReadingPageSkeleton } from "@/features/site/pages";
import { CardSkeleton } from "@/ui/components/page-skeleton";
import { Skeleton } from "@/ui/components/states";

/** Notícias on its way: the title, the search field and the first days of the feed (`NewsFeed`). */
export default function Loading() {
  const t = useTranslations();
  return (
    <ReadingPageSkeleton title={t("common.news")}>
      <Skeleton className="h-12 w-full rounded-medium desk:h-11" />
      <CardSkeleton lines={2} />
      <CardSkeleton lines={4} />
      <CardSkeleton lines={2} />
    </ReadingPageSkeleton>
  );
}
