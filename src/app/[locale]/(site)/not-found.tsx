import { useTranslations } from "next-intl";

import { MessagePage } from "@/features/site/pages";
import { ButtonLink } from "@/ui/components/buttons";

export default function NotFound() {
  const t = useTranslations();
  return (
    <MessagePage title={t("site.notFound.title")}>
      <ButtonLink href="/" className="sm:w-auto">
        {t("common.home")}
      </ButtonLink>
    </MessagePage>
  );
}
