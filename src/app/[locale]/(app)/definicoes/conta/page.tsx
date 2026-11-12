import { getTranslations } from "next-intl/server";

import { readAccountProfile } from "@/data/account/profile";
import { accountSession } from "@/data/account/session";
import { type DeletionResult, readDeletionResult } from "@/domain/account/deletion";
import { DeleteAccount } from "@/features/settings/delete-account";
import { SettingsGroup, ValueRow } from "@/features/settings/settings-ui";
import { SignedInPage, signedInMetadata } from "@/features/shell/placeholder-page";
import { APP_STORE_SUBSCRIPTIONS_URL } from "@/features/site/site";
import { Link } from "@/i18n/navigation";
import { ErrorState } from "@/ui/components/states";
import { Icon } from "@/ui/icons/icon";

export const generateMetadata = signedInMetadata("common.manageAccount");

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PROVIDERS: Record<string, string> = { google: "Google", apple: "Apple" };

const NOTICE: Record<DeletionResult, string> = {
  cancelled: "site.deletion.cancelled",
  retry: "authentication.error.deletionRetry",
  connection: "authentication.error.deletionCheckConnection",
  signIn: "authentication.error.deletionSignInAgain",
  changed: "authentication.error.accountChanged",
};

/**
 * Gerir conta (iOS account management): how the person signs in, and account deletion. A failed or cancelled
 * deletion comes back here (`?eliminacao=`) with the person still signed in.
 */
export default async function AccountPage({ searchParams }: Props) {
  const t = await getTranslations();
  const raw = (await searchParams).eliminacao;
  const result = readDeletionResult(Array.isArray(raw) ? raw[0] : raw);
  const session = await accountSession();
  const profile = session ? await readAccountProfile(session) : null;
  const providers = profile?.providers.map((provider) => PROVIDERS[provider] ?? provider) ?? [];

  return (
    <SignedInPage titleKey="common.manageAccount">
      <Link href="/definicoes" prefetch={false} className="-mt-6 inline-flex min-h-11 items-center gap-1 self-start text-secondary font-semibold text-accent">
        <Icon name="chevron-left" scale="s" />
        {t("profile.navigation.title")}
      </Link>

      {result ? (
        <div role="status" className="flex max-w-2xl flex-col gap-1 rounded-medium bg-elevated-background px-4 py-3" data-testid="deletion-result">
          {result === "cancelled" ? null : <p className="text-body font-semibold text-primary-text">{t("errors.account.deleteFailed")}</p>}
          <p className="text-secondary text-secondary-text">{t(NOTICE[result] as never)}</p>
        </div>
      ) : null}

      {!session || !profile ? (
        <ErrorState message={t("components.placeholder.loadFailed")} />
      ) : (
        <>
          <SettingsGroup id="account-access" title={t("settings.account.accessTitle")}>
            <ValueRow label={t("settings.account.signInMethods")}>{providers.length > 0 ? providers.join(" · ") : t("settings.account.signInProviders")}</ValueRow>
            {profile.email ? <ValueRow label={t("common.account")}>{profile.email}</ValueRow> : null}
          </SettingsGroup>

          <section aria-labelledby="account-deletion" className="flex max-w-2xl flex-col gap-3">
            <h2 id="account-deletion" className="text-section text-primary-text">
              {t("common.deleteAccount")}
            </h2>
            <p className="flex items-start gap-2 text-body font-semibold text-primary-text">
              <Icon name="warning" className="mt-0.5 shrink-0 text-negative" />
              {t("settings.deleteAccount.irreversible")}
            </p>
            <p className="text-body text-primary-text">{t("settings.deleteAccount.warning")}</p>
            <p className="text-secondary text-secondary-text">{t("settings.deleteAccount.accountRemains")}</p>
            <p className="text-secondary text-secondary-text">
              {t("settings.deleteAccount.subscriptionNote")}{" "}
              <a href={APP_STORE_SUBSCRIPTIONS_URL} className="font-semibold text-accent underline underline-offset-4">
                {t("settings.deleteAccount.manageSubscription")}
              </a>
            </p>
            <DeleteAccount userID={session.userID} email={profile.email} apple={profile.apple} />
          </section>
        </>
      )}
    </SignedInPage>
  );
}
