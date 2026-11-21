import { useTranslations } from "next-intl";

import { MessagePage } from "@/features/site/pages";
import { ButtonLink } from "@/ui/components/buttons";

/** A malformed, unknown or revoked share link (or one whose owner is no longer Plus): one state for all. */
export default function ShareNotFound() {
  const t = useTranslations();
  return (
    <MessagePage
      title={t("site.share.notFoundTitle")}
      message={
        <p className="text-body text-secondary-text" data-testid="share-not-found">
          {t("site.share.notFoundMessage")}
        </p>
      }
    >
      <ButtonLink href="/" className="sm:w-auto">
        {t("common.home")}
      </ButtonLink>
    </MessagePage>
  );
}
