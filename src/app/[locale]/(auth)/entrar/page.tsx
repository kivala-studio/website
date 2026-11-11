import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { publicEnv } from "@/config/public-env";
import { currentAccount } from "@/data/auth/account";
import { readSignInReason, safeNextPath } from "@/domain/auth/next-path";
import { SignInOptions } from "@/features/auth/sign-in-options";
import { PalancaMark } from "@/features/site/chrome";
import { INDEXABLE_PAGES } from "@/features/site/site";
import { Link } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as Locale });
  return { title: t("onboarding.navigation.signIn"), robots: { index: false } };
}

/**
 * `/entrar`: Google and Apple only (no email sign-up exists). A signed-in visitor goes straight on. `local`
 * builds add a password form for the seeded development accounts; it is rendered on the server only, so no
 * client bundle carries it, and its endpoint does not exist in other builds.
 */
export default async function SignInPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  const next = safeNextPath(first(query.next), locale === "en" ? "/en/inicio" : "/inicio");
  if (await currentAccount()) redirect(next);
  const t = await getTranslations({ locale: locale as Locale });
  const reason = readSignInReason(first(query.motivo));

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-4 py-10 sm:px-6">
      <Link href="/" prefetch={false} aria-label={t("site.header.homeLabel")} className="-ml-1 inline-flex min-h-11 items-center gap-2 self-start rounded-small px-1 text-primary-text">
        <PalancaMark className="size-10" />
      </Link>
      <div className="flex flex-col gap-3">
        <h1 className="text-display text-primary-text">{t("onboarding.navigation.signIn")}</h1>
        <p className="text-body text-secondary-text">{t("site.auth.noBankLink")}</p>
      </div>
      {reason === "expired" || reason === "signedOutHere" ? (
        <div role="status" className="flex flex-col gap-1 rounded-medium bg-elevated-background px-4 py-3">
          <p className="text-body font-semibold text-primary-text">
            {t(reason === "expired" ? "errors.session.signInAgainTitle" : "errors.session.signedOutHereTitle")}
          </p>
          <p className="text-secondary text-secondary-text">
            {t(reason === "expired" ? "errors.session.expiredMessage" : "errors.session.signOutOthersFailed")}
          </p>
        </div>
      ) : null}
      <SignInOptions next={next} available={publicEnv.dataMode !== "demo"} failed={reason === "failed"} />
      {publicEnv.dataMode === "demo" ? <p className="text-secondary text-secondary-text">{t("site.auth.unavailable")}</p> : null}
      {process.env.NEXT_PUBLIC_DATA_MODE === "local" ? (
        <form method="post" action="/auth/local-password" className="flex flex-col gap-3 border-t border-separator pt-6">
          <input type="hidden" name="next" value={next} />
          <label className="flex flex-col gap-1 text-secondary font-semibold text-primary-text">
            {t("site.auth.email")}
            <input name="email" type="email" required autoComplete="username" className="min-h-12 rounded-medium border border-control-outline bg-elevated-background px-4 text-body font-normal" />
          </label>
          <label className="flex flex-col gap-1 text-secondary font-semibold text-primary-text">
            {t("site.auth.password")}
            <input name="password" type="password" required autoComplete="current-password" className="min-h-12 rounded-medium border border-control-outline bg-elevated-background px-4 text-body font-normal" />
          </label>
          <button type="submit" className="motion-press inline-flex min-h-14 items-center justify-center rounded-full bg-accent px-5 text-body font-semibold text-on-accent">
            {t("onboarding.navigation.signIn")}
          </button>
        </form>
      ) : null}
      <Link href={INDEXABLE_PAGES.policy} prefetch={false} className="inline-flex min-h-11 items-center self-start text-secondary font-semibold text-accent">
        {t("common.privacyPolicy")}
      </Link>
    </main>
  );
}
