"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { personalisationSession } from "@/data/personalisation/personalisation";
import { useAccount } from "@/features/account/account-provider";

import { SettingsGroup } from "./settings-ui";

/** Personalização (iOS `PersonalizationSettingsSection`): the two resets, both local to this browser. */
export function PersonalisationGroup() {
  const t = useTranslations();
  const userID = useAccount()?.userID ?? null;
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reset = async (kind: "interests" | "usefulness") => {
    if (!userID || busy) return;
    setBusy(true);
    await (kind === "interests" ? personalisationSession.resetBehavior(userID) : personalisationSession.resetFeedback(userID));
    setBusy(false);
    if (personalisationSession.userID !== userID) return;
    setMessage(t(kind === "interests" ? "settings.personalization.interestsResetMessage" : "settings.personalization.usefulnessResetMessage"));
  };
  const row = "flex min-h-12 w-full items-center py-2 text-left text-body text-accent disabled:opacity-50";

  return (
    <SettingsGroup id="settings-personalisation" title={t("settings.personalization.title")}>
      <button type="button" className={row} disabled={!userID || busy} onClick={() => void reset("interests")} data-testid="reset-interests">
        {t("settings.personalization.resetInterests")}
      </button>
      <button type="button" className={row} disabled={!userID || busy} onClick={() => void reset("usefulness")} data-testid="reset-usefulness">
        {t("settings.personalization.resetUsefulness")}
      </button>
      {message ? (
        <p role="status" className="py-3 text-caption text-secondary-text" data-testid="personalisation-status">
          {message}
        </p>
      ) : null}
    </SettingsGroup>
  );
}
