import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { requestTime } from "@/data/clock";
import type { SubscriptionAccess } from "@/domain/account/access";
import { profileInitials } from "@/domain/auth/account";
import { PRIVACY_COOKIE, parsePrivacyMode } from "@/domain/privacy/privacy";
import { AccountProvider } from "@/features/account/account-provider";
import type { CatalogueRow } from "@/features/market/browse/price-cell";
import { MarketArea } from "@/features/market/market-provider";
import { IntelligenceProvider } from "@/features/intelligence/intelligence-provider";
import { PrivacyModeProvider } from "@/features/privacy/privacy-mode";
import { CommandPalette, SearchButton, SearchField } from "@/features/search/command-palette";
import { BrandLockup } from "@/features/site/chrome";
import { AreaMessages } from "@/i18n/area-messages";

import { TABS } from "./destinations";
import { PendingPage } from "./pending-page";
import { type ShellChromeProps, ShellNav, ShellSidebar, ShellTopBar } from "./shell-nav";

/**
 * The signed-in app. From 1024 px: the sidebar down the left edge (tabs, search, unusual activity, the activity inbox,
 * the profile) and the page across the rest of the window (`data-shell="app"` lifts the page column's width cap in
 * `globals.css`). Below: the top bar (search, unusual activity, the bell, the profile initials) and the bottom tab bar
 * (iOS tab bar). One search palette, one market store and one account store serve every page. Pages render their own
 * `<main>`.
 */
export async function AppShell({
  name,
  account,
  rows,
  children,
}: {
  name: string | null;
  account: {
    userID: string;
    watchlist: readonly string[];
    access: SubscriptionAccess | null;
    hasUnread: Promise<boolean>;
  };
  rows: readonly CatalogueRow[];
  children: ReactNode;
}) {
  const t = await getTranslations();
  const privacy = parsePrivacyMode((await cookies()).get(PRIVACY_COOKIE)?.value);
  const displayName = name ?? t("authentication.profile.defaultName");
  const tabs = TABS.map(({ href, labelKey, icon }) => ({
    href,
    icon,
    label: t(labelKey as never),
  }));
  const chrome: Omit<ShellChromeProps, "search"> = {
    tabs,
    navLabel: t("site.header.navLabel"),
    homeLabel: t("site.header.homeLabel"),
    logo: <BrandLockup />,
    initials: profileInitials(displayName),
    profileLabel: t("home.accessibility.profile", { arg1: displayName }),
    unusualLabel: t("unusualActivity.title"),
    activityLabel: t("common.activity"),
    activityStates: { new: t("home.accessibility.activityNew"), none: t("home.accessibility.activityNone") },
  };

  return (
    <AreaMessages area="app">
      <MarketArea>
        <AccountProvider initial={account}>
          <PrivacyModeProvider initial={privacy}>
            <IntelligenceProvider>
              <CommandPalette rows={rows} renderedAt={requestTime()}>
                <div data-shell="app" className="flex min-h-dvh pb-20 lg:pb-0">
                  <ShellSidebar {...chrome} name={displayName} search={<SearchField />} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="contents lg:hidden">
                      <ShellTopBar {...chrome} search={<SearchButton />} />
                    </div>
                    <PendingPage>{children}</PendingPage>
                  </div>
                  <ShellNav items={tabs} label={chrome.navLabel} />
                </div>
              </CommandPalette>
            </IntelligenceProvider>
          </PrivacyModeProvider>
        </AccountProvider>
      </MarketArea>
    </AreaMessages>
  );
}
