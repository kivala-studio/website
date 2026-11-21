import { useTranslations } from "next-intl";

import { ReadingPageSkeleton } from "@/features/site/pages";

export default function Loading() {
  const t = useTranslations();
  return <ReadingPageSkeleton title={t("site.legal.supportTitle")} />;
}
