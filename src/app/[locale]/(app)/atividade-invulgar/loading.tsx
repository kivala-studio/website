import { useTranslations } from "next-intl";

import { SignedInPageSkeleton } from "@/features/shell/placeholder-page";
import { CardSkeleton, RowsSkeleton } from "@/ui/components/page-skeleton";

/** Atividade invulgar on its way: the title and refresh, then the session's instruments (`UnusualActivityView`). */
export default function Loading() {
  const t = useTranslations();
  return (
    <SignedInPageSkeleton title={t("unusualActivity.title")} actions={1} narrow className="gap-4">
      <CardSkeleton>
        <RowsSkeleton rows={4} />
      </CardSkeleton>
    </SignedInPageSkeleton>
  );
}
