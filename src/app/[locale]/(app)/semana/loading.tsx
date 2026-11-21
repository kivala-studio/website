import { useTranslations } from "next-intl";

import { SignedInPageSkeleton } from "@/features/shell/placeholder-page";
import { CardSkeleton } from "@/ui/components/page-skeleton";

/** A semana on its way: the title and the privacy button, then the days (`WeekAheadView`). */
export default function Loading() {
  const t = useTranslations();
  return (
    <SignedInPageSkeleton title={t("weekAhead.summary.title")} actions={1} narrow>
      <CardSkeleton lines={3} />
      <CardSkeleton lines={3} />
      <CardSkeleton lines={2} />
    </SignedInPageSkeleton>
  );
}
