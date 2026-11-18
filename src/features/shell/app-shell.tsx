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
import { CommandPalette } from "@/features/search/command-palette";
import { BrandLockup } from "@/features/site/chrome";
import { AreaMessages } from "@/i18n/area-messages";

import { TABS } from "./destinations";
import { ShellNav, ShellTopBar } from "./shell-nav";

/**
 * The signed-in app: the shared top bar (tabs as pills from 1024 px, the search palette, unusual activity, the
 * activity bell and the profile initials) and, below 1024 px, the bottom tab bar (iOS tab bar). One market store
 * and one account store serve every page of the tab. Pages render their own `<main>`.
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
    hasUnread: boolean;
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
  const navLabel = t("site.header.navLabel");

  return (
    <AreaMessages area="app">
      <MarketArea>
        <AccountProvider initial={account}>
          <PrivacyModeProvider initial={privacy}>
            <IntelligenceProvider>
              <div className="flex min-h-dvh flex-col pb-20 lg:pb-0">
                <ShellTopBar
                  tabs={tabs}
                  navLabel={navLabel}
                  homeLabel={t("site.header.homeLabel")}
                  logo={<BrandLockup />}
                  initials={profileInitials(displayName)}
                  profileLabel={t("home.accessibility.profile", {
                    arg1: displayName,
                  })}
                  unusualLabel={t("unusualActivity.title")}
                  activityLabel={t("common.activity")}
                  activityStates={{ new: t("home.accessibility.activityNew"), none: t("home.accessibility.activityNone") }}
                  hasUnread={account.hasUnread}
                  search={<CommandPalette rows={rows} renderedAt={requestTime()} />}
                />
                {children}
                <ShellNav items={tabs} label={navLabel} />
              </div>
            </IntelligenceProvider>
          </PrivacyModeProvider>
        </AccountProvider>
      </MarketArea>
    </AreaMessages>
  );
}
