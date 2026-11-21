import { useTranslations } from "next-intl";

import { siteMetadata } from "@/features/site/metadata";
import { CARD_LINK, DraftLegalPage } from "@/features/site/pages";
import { INDEXABLE_PAGES } from "@/features/site/site";
import { Link } from "@/i18n/navigation";
import { Card } from "@/ui/components/layout";

export const generateMetadata = siteMetadata({ path: INDEXABLE_PAGES.support, image: "support" }, (t) => ({
  title: t("site.legal.supportTitle"),
  description: t("site.meta.supportDescription"),
}));

// The public deletion page (`/eliminar-conta`, the URL the stores ask for) is linked from here.
export default function SupportPage() {
  const t = useTranslations();
  return (
    <DraftLegalPage title={t("site.legal.supportTitle")}>
      <Card title={t("common.account")} titleId="account">
        <Link href={INDEXABLE_PAGES.deletion} prefetch="intent" className={CARD_LINK}>
          {t("common.deleteAccount")}
        </Link>
      </Card>
    </DraftLegalPage>
  );
}
