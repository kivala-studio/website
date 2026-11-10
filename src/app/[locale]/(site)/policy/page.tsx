import { useTranslations } from "next-intl";

import { siteMetadata } from "@/features/site/metadata";
import { DraftLegalPage } from "@/features/site/pages";
import { INDEXABLE_PAGES } from "@/features/site/site";

// Linked from the iOS app (Settings) and the App Store listing: the path must stay exactly /policy.
export const generateMetadata = siteMetadata({ path: INDEXABLE_PAGES.policy, image: "policy" }, (t) => ({
  title: t("common.privacyPolicy"),
  description: t("site.meta.policyDescription"),
}));

export default function PolicyPage() {
  const t = useTranslations();
  return <DraftLegalPage title={t("common.privacyPolicy")} />;
}
