import { getTranslations } from "next-intl/server";

import { SignOutForm } from "@/features/auth/sign-out-form";
import { SignedInPage, signedInMetadata } from "@/features/shell/placeholder-page";
import { Button } from "@/ui/components/buttons";

export const generateMetadata = signedInMetadata("profile.navigation.title");

/** Profile and settings (W10); sign-out lives here, as in the iOS profile sheet. */
export default async function ProfilePage() {
  const t = await getTranslations();
  return (
    <SignedInPage titleKey="profile.navigation.title">
      <SignOutForm className="max-w-sm">
        <Button type="submit" kind="destructive">
          {t("common.signOut")}
        </Button>
      </SignOutForm>
    </SignedInPage>
  );
}
