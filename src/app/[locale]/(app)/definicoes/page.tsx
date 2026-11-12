import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";

import { readAccountProfile } from "@/data/account/profile";
import { accountSession } from "@/data/account/session";
import { ACCOUNT_PAGE } from "@/domain/account/deletion";
import { profileInitials } from "@/domain/auth/account";
import { NotificationSettings } from "@/features/activity/notification-settings";
import { SignOutForm } from "@/features/auth/sign-out-form";
import { LanguageChoice } from "@/features/settings/language-choice";
import { MarketDataGroup } from "@/features/settings/market-data-group";
import { ControlRow, DisclosureRow, LinkRow, SettingsGroup } from "@/features/settings/settings-ui";
import { SignedInPage, signedInMetadata } from "@/features/shell/placeholder-page";
import { INDEXABLE_PAGES } from "@/features/site/site";
import { ThemeSwitch } from "@/ui/components/controls";
import { Icon } from "@/ui/icons/icon";
import { THEME_COOKIE, parseTheme } from "@/ui/theme/theme";

export const generateMetadata = signedInMetadata("profile.navigation.title");

/**
 * Perfil (iOS `ProfileView` + `SettingsView`), in the iOS group order. iOS-only rows are left out: subscription
 * (no web purchases yet), notification permission, lock screen, widget privacy and personalisation (W14).
 */
export default async function ProfilePage() {
  const t = await getTranslations();
  const session = await accountSession();
  const profile = session ? await readAccountProfile(session) : null;
  const name = profile?.displayName ?? t("authentication.profile.defaultName");
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <SignedInPage titleKey="profile.navigation.title">
      <div className="flex max-w-2xl items-center gap-4" data-testid="identity">
        <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent-soft text-headline font-semibold text-accent">
          {profileInitials(name)}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-headline text-primary-text [overflow-wrap:anywhere]">{name}</span>
          {profile?.email ? <span className="text-secondary text-secondary-text [overflow-wrap:anywhere]">{profile.email}</span> : null}
        </div>
      </div>

      <SettingsGroup id="settings-account" title={t("common.account")}>
        <LinkRow href={ACCOUNT_PAGE} icon="profile" label={t("common.manageAccount")} />
        <SignOutForm>
          <button type="submit" className="flex min-h-12 w-full items-center gap-3 py-2 text-left text-body text-negative">
            <Icon name="arrow-right" className="shrink-0" />
            {t("common.signOut")}
          </button>
        </SignOutForm>
      </SettingsGroup>

      <NotificationSettings />

      <SettingsGroup id="settings-appearance" title={t("settings.appearance.title")}>
        <ControlRow label={t("common.theme")}>
          <ThemeSwitch initial={theme} />
        </ControlRow>
        <ControlRow label={t("settings.appearance.language")}>
          <LanguageChoice label={t("settings.appearance.language")} />
        </ControlRow>
      </SettingsGroup>

      <SettingsGroup id="settings-app" title={t("settings.app.title")}>
        <DisclosureRow icon="info" label={t("settings.about.title")}>
          <p>{t("settings.about.description")}</p>
          <p>{t("settings.about.disclaimer")}</p>
        </DisclosureRow>
        <LinkRow href={INDEXABLE_PAGES.terms} icon="document" label={t("common.terms")} />
        <LinkRow href={INDEXABLE_PAGES.policy} icon="shield-check" label={t("common.privacyPolicy")} />
        <DisclosureRow icon="markets" label={t("settings.dataSources.title")}>
          <p>{t("settings.dataSources.description")}</p>
        </DisclosureRow>
      </SettingsGroup>

      <MarketDataGroup />
    </SignedInPage>
  );
}
