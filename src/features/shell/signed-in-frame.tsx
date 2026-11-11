import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { hasUnreadActivity } from "@/data/account/activity";
import { readWatchlist } from "@/data/account/watchlist";
import type { SignedInAccount } from "@/data/auth/account";
import { REQUEST_PATH_HEADER } from "@/data/auth/request-path";
import { requestTime } from "@/data/clock";
import { accountSession } from "@/data/account/session";
import { safeNextPath } from "@/domain/auth/next-path";
import { AccountSetup } from "@/features/account-setup/account-setup";
import { readAccountState } from "@/features/account/state";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { AreaMessages } from "@/i18n/area-messages";

import { AppShell } from "./app-shell";

/** A signed-in page: account setup first when the account still needs it, the app shell otherwise. */
export async function SignedInFrame({ account, children }: { account: SignedInAccount; children: ReactNode }) {
  const session = await accountSession();
  if (!session || session.userID !== account.id) return <SessionUnavailable />;
  if (account.needsSetup && session.kind === "supabase") {
    const supabase = session.client;
    const [rows, watched] = await Promise.all([catalogueRows(requestTime()), readWatchlist(supabase, account.id).catch(() => [])]);
    return (
      <AreaMessages area="setup">
        <AccountSetup
          userID={account.id}
          initialName={account.name}
          instruments={rows?.map(({ id, symbol, name, issuer, kind }) => ({ id, symbol, name, issuer, kind })) ?? null}
          watchedIDs={watched}
        />
      </AreaMessages>
    );
  }
  const [state, hasUnread, rows] = await Promise.all([
    readAccountState(session),
    session.kind === "supabase" ? hasUnreadActivity(session.client) : false,
    catalogueRows(requestTime()),
  ]);
  return (
    <AppShell name={account.name} hasUnread={hasUnread} account={{ userID: state.userID, watchlist: state.watchlist, access: state.access }} rows={rows ?? []}>
      {children}
    </AppShell>
  );
}

/** A saved session that could not be refreshed for a connectivity reason (iOS root state 3). */
export async function SessionUnavailable() {
  const t = await getTranslations();
  const path = safeNextPath((await headers()).get(REQUEST_PATH_HEADER));
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-display text-primary-text">{t("common.sessionRecoveryFailed")}</h1>
      <p className="text-body text-secondary-text">{t("common.checkConnectionMessage")}</p>
      <a href={path} className="motion-press inline-flex min-h-14 items-center justify-center rounded-full bg-accent px-5 text-body font-semibold text-on-accent">
        {t("common.tryAgain")}
      </a>
    </main>
  );
}
