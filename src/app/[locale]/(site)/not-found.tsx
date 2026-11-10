import { useTranslations } from "next-intl";

import { ReadingPage } from "@/features/site/pages";
import { ButtonLink } from "@/ui/components/buttons";

export default function NotFound() {
  const t = useTranslations();
  return (
    <ReadingPage title={t("site.notFound.title")}>
      <ButtonLink href="/" prefetch={false} className="sm:w-auto! sm:self-start">
        {t("common.home")}
      </ButtonLink>
    </ReadingPage>
  );
}
