import { useTranslations } from "next-intl";

import { SignedInPageSkeleton } from "@/features/shell/placeholder-page";

/** A recap on its way. */
export default function Loading() {
  const t = useTranslations();
  return <SignedInPageSkeleton title={t("home.contextCard.availableSummaries")} />;
}
