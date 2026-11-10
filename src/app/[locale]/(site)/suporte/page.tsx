import { useTranslations } from "next-intl";

import { siteMetadata } from "@/features/site/metadata";
import { DraftLegalPage } from "@/features/site/pages";
import { INDEXABLE_PAGES } from "@/features/site/site";

export const generateMetadata = siteMetadata({ path: INDEXABLE_PAGES.support, image: "support" }, (t) => ({
  title: t("site.legal.supportTitle"),
  description: t("site.meta.supportDescription"),
}));

export default function SupportPage() {
  const t = useTranslations();
  return <DraftLegalPage title={t("site.legal.supportTitle")} />;
}
