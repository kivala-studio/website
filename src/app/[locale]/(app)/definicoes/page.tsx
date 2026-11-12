import { getTranslations } from "next-intl/server";

import { NotificationSettings } from "@/features/activity/notification-settings";
import { SignOutForm } from "@/features/auth/sign-out-form";
import { SignedInPage, signedInMetadata } from "@/features/shell/placeholder-page";
import { Button } from "@/ui/components/buttons";

export const generateMetadata = signedInMetadata("profile.navigation.title");

/** Profile and settings (the rest arrives in W10); notifications are shared with the apps. Sign-out lives here, as in the iOS profile sheet. */
export default async function ProfilePage() {
  const t = await getTranslations();
  return (
    <SignedInPage titleKey="profile.navigation.title">
      <NotificationSettings />
      <SignOutForm className="max-w-sm">
        <Button type="submit" kind="destructive">
          {t("common.signOut")}
        </Button>
      </SignOutForm>
    </SignedInPage>
  );
}
