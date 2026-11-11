import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { requestTime } from "@/data/clock";
import type { SubscriptionAccess } from "@/domain/account/access";
import { profileInitials } from "@/domain/auth/account";
import { AccountProvider } from "@/features/account/account-provider";
import type { CatalogueRow } from "@/features/market/browse/price-cell";
import { MarketArea } from "@/features/market/market-provider";
import { CommandPalette } from "@/features/search/command-palette";
import { PalancaMark } from "@/features/site/chrome";
import { AreaMessages } from "@/i18n/area-messages";
import { Link } from "@/i18n/navigation";

import { TABS } from "./destinations";
import { ShellHeader, ShellNav } from "./shell-nav";

/**
 * The signed-in app: a sidebar from 1024 px, a bottom bar below it (iOS tab bar), and a header with the profile
 * initials, the search palette, unusual activity and the activity bell. One market store and one account store
 * serve every page of the tab. Pages render their own `<main>`.
 */
export async function AppShell({
  name,
  hasUnread,
  account,
  rows,
  children,
}: {
  name: string | null;
  hasUnread: boolean;
  account: {
    userID: string;
    watchlist: readonly string[];
    access: SubscriptionAccess | null;
  };
  rows: readonly CatalogueRow[];
  children: ReactNode;
}) {
  const t = await getTranslations();
  const displayName = name ?? t("authentication.profile.defaultName");
  const tabs = TABS.map(({ href, labelKey, icon }) => ({
    href,
    icon,
    label: t(labelKey as never),
  }));
  const navLabel = t("site.header.navLabel");

  return (
    <AreaMessages area="app">
      <MarketArea>
        <AccountProvider initial={account}>
          <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
            <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:border-r lg:border-separator lg:px-3 lg:py-4">
              <Link
                href="/inicio"
                aria-label={t("site.header.homeLabel")}
                className="inline-flex min-h-11 items-center gap-2 self-start rounded-small px-2 text-primary-text"
              >
                <PalancaMark className="size-8" />
                <span className="text-body font-semibold tracking-wide">
                  {t("common.appName")}
                </span>
              </Link>
              <ShellNav items={tabs} label={navLabel} variant="sidebar" />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
              <ShellHeader
                initials={profileInitials(displayName)}
                profileLabel={t("home.accessibility.profile", {
                  arg1: displayName,
                })}
                unusualLabel={t("unusualActivity.title")}
                activityLabel={t("common.activity")}
                activityState={t(
                  hasUnread
                    ? "home.accessibility.activityNew"
                    : "home.accessibility.activityNone",
                )}
                hasUnread={hasUnread}
                search={
                  <CommandPalette rows={rows} renderedAt={requestTime()} />
                }
              />
              {children}
            </div>
            <ShellNav items={tabs} label={navLabel} variant="bar" />
          </div>
        </AccountProvider>
      </MarketArea>
    </AreaMessages>
  );
}
