import { useTranslations } from "next-intl";

import { siteMetadata } from "@/features/site/metadata";
import { DraftLegalPage } from "@/features/site/pages";
import { INDEXABLE_PAGES } from "@/features/site/site";

export const generateMetadata = siteMetadata({ path: INDEXABLE_PAGES.terms, image: "terms" }, (t) => ({
  title: t("site.legal.termsTitle"),
  description: t("site.meta.termsDescription"),
}));

export default function TermsPage() {
  const t = useTranslations();
  return <DraftLegalPage title={t("site.legal.termsTitle")} />;
}
