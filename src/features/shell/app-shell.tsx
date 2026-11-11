import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { profileInitials } from "@/domain/auth/account";
import { PalancaMark } from "@/features/site/chrome";
import { Link } from "@/i18n/navigation";

import { TABS } from "./destinations";
import { ShellHeader, ShellNav } from "./shell-nav";

/**
 * The signed-in app: a sidebar from 1024 px, a bottom bar below it (iOS tab bar), and a header with the profile
 * initials, unusual activity and the activity bell. Pages render their own `<main>`.
 */
export async function AppShell({ name, hasUnread, children }: { name: string | null; hasUnread: boolean; children: ReactNode }) {
  const t = await getTranslations();
  const displayName = name ?? t("authentication.profile.defaultName");
  const tabs = TABS.map(({ href, labelKey, icon }) => ({ href, icon, label: t(labelKey as never) }));
  const navLabel = t("site.header.navLabel");

  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:border-r lg:border-separator lg:px-3 lg:py-4">
        <Link href="/inicio" aria-label={t("site.header.homeLabel")} className="inline-flex min-h-11 items-center gap-2 self-start rounded-small px-2 text-primary-text">
          <PalancaMark className="size-8" />
          <span className="text-body font-semibold tracking-wide">{t("common.appName")}</span>
        </Link>
        <ShellNav items={tabs} label={navLabel} variant="sidebar" />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <ShellHeader
          initials={profileInitials(displayName)}
          profileLabel={t("home.accessibility.profile", { arg1: displayName })}
          unusualLabel={t("unusualActivity.title")}
          activityLabel={t("common.activity")}
          activityState={t(hasUnread ? "home.accessibility.activityNew" : "home.accessibility.activityNone")}
          hasUnread={hasUnread}
        />
        {children}
      </div>
      <ShellNav items={tabs} label={navLabel} variant="bar" />
    </div>
  );
}
