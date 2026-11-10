import type { Metadata } from "next";
import { type Locale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { use } from "react";

import { parseInviteCode } from "@/features/site/invite-code";
import { InviteKeeper } from "@/features/site/invite-keeper";
import { pageMetadata } from "@/features/site/metadata";
import { ReadingPage } from "@/features/site/pages";
import { StoreButton } from "@/features/site/visuals";

type Props = { params: Promise<{ locale: string; code: string }> };

// The code stays out of the title, the canonical URL, the sitemap and the Referer sent to other sites.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, code } = await params;
  if (!parseInviteCode(code)) return {};
  const t = await getTranslations({ locale: locale as Locale });
  return {
    ...pageMetadata({
      locale: locale as Locale,
      path: "/",
      title: t("referral.redeem.title"),
      description: t("site.meta.inviteDescription"),
      image: "invite",
      indexable: false,
    }),
    referrer: "no-referrer",
  };
}

export default function InvitePage({ params }: Props) {
  const code = parseInviteCode(use(params).code);
  if (!code) notFound();
  const t = useTranslations();

  return (
    <ReadingPage title={t("referral.redeem.title")}>
      <InviteKeeper code={code} />
      <p className="text-headline tracking-[0.12em] text-primary-text select-all">{code}</p>
      <div className="flex flex-col gap-2">
        <p className="text-body text-primary-text sm:text-price sm:font-normal">{t("site.invite.offer")}</p>
        <p className="text-secondary text-secondary-text">{t("referral.error.notEligible")}</p>
      </div>
      <StoreButton className="w-full sm:w-auto sm:self-start" />
    </ReadingPage>
  );
}
