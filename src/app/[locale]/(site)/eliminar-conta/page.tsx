import { useTranslations } from "next-intl";

import { siteMetadata } from "@/features/site/metadata";
import { ReadingPage, SupportContact } from "@/features/site/pages";
import { APP_STORE_SUBSCRIPTIONS_URL, INDEXABLE_PAGES, SIGN_IN_PATH } from "@/features/site/site";
import { ButtonLink } from "@/ui/components/buttons";
import { Icon } from "@/ui/icons/icon";

// The public account-deletion URL the stores ask for. Works signed out; web deletion itself arrives in W10.
export const generateMetadata = siteMetadata({ path: INDEXABLE_PAGES.deletion, image: "deletion" }, (t) => ({
  title: t("common.deleteAccount"),
  description: t("site.meta.deletionDescription"),
}));

export default function DeleteAccountPage() {
  const t = useTranslations();
  const steps = [t("profile.navigation.title"), t("common.manageAccount"), t("common.deleteAccount")];

  return (
    <ReadingPage title={t("common.deleteAccount")}>
      <div className="flex flex-col gap-3 text-body text-primary-text">
        <p>{t("settings.deleteAccount.warning")}</p>
        <p className="flex items-start gap-2 font-semibold">
          <Icon name="warning" className="mt-0.5 text-negative" />
          <span>{t("settings.deleteAccount.irreversible")}</span>
        </p>
        <p>{t("settings.deleteAccount.noRecovery")}</p>
      </div>

      <section aria-labelledby="in-app" className="flex flex-col gap-3">
        <h2 id="in-app" className="text-section text-primary-text">
          {t("site.deletion.inApp")}
        </h2>
        <ol aria-label={t("site.deletion.path")} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-primary-text">
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              {index > 0 ? <Icon name="chevron-right" scale="s" className="text-tertiary-text" /> : null}
              <span className="font-semibold">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="on-web" className="flex flex-col gap-4">
        <h2 id="on-web" className="text-section text-primary-text">
          {t("site.deletion.onWeb")}
        </h2>
        <p className="text-body text-primary-text">{t("site.deletion.webMessage")}</p>
        <ButtonLink href={`${SIGN_IN_PATH}?next=/definicoes`} prefetch={false} className="sm:w-auto! sm:self-start">
          {t("onboarding.navigation.signIn")}
        </ButtonLink>
      </section>

      <div className="flex flex-col gap-3 text-secondary text-secondary-text">
        <p>{t("settings.deleteAccount.accountRemains")}</p>
        <p>{t("settings.deleteAccount.subscriptionNote")}</p>
        <a href={APP_STORE_SUBSCRIPTIONS_URL} className="inline-flex min-h-11 items-center self-start font-semibold text-accent underline underline-offset-4">
          {t("settings.deleteAccount.manageSubscription")}
        </a>
      </div>

      <SupportContact />
    </ReadingPage>
  );
}
