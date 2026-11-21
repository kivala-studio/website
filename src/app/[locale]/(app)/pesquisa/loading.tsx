import { useTranslations } from "next-intl";

import { SignedInPageSkeleton } from "@/features/shell/placeholder-page";
import { RowsSkeleton } from "@/ui/components/page-skeleton";
import { Skeleton } from "@/ui/components/states";

/** Pesquisa on its way: the title, the field and the first results (`SearchPanel`). */
export default function Loading() {
  const t = useTranslations();
  return (
    <SignedInPageSkeleton title={t("common.search")} narrow>
      <Skeleton className="h-12 w-full rounded-medium desk:h-11" />
      <RowsSkeleton rows={5} />
    </SignedInPageSkeleton>
  );
}
