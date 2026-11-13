import { useTranslations } from "next-intl";

import { ReadingPage } from "@/features/site/pages";
import { ButtonLink } from "@/ui/components/buttons";

/** A malformed, unknown or revoked share link (or one whose owner is no longer Plus): one state for all. */
export default function ShareNotFound() {
  const t = useTranslations();
  return (
    <ReadingPage title={t("site.share.notFoundTitle")}>
      <p className="text-body text-secondary-text" data-testid="share-not-found">
        {t("site.share.notFoundMessage")}
      </p>
      <ButtonLink href="/" prefetch={false} className="sm:w-auto! sm:self-start">
        {t("common.home")}
      </ButtonLink>
    </ReadingPage>
  );
}
