"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/ui/components/buttons";
import { MessageCard } from "@/ui/components/layout";
import { Icon } from "@/ui/icons/icon";

/** Replaces every page while the `web-maintenance` flag is on. */
export function MaintenanceScreen() {
  const t = useTranslations();
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center bg-app-background px-4 py-16">
      <MessageCard className="items-center text-center">
        <span aria-hidden className="flex size-13 items-center justify-center rounded-full bg-warning/12 text-[1.75rem] text-warning">
          <Icon name="warning" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-display text-primary-text">{t("appAvailability.maintenance.title")}</h1>
          <p className="text-body text-secondary-text">{t("appAvailability.maintenance.message")}</p>
        </div>
        <Button kind="secondary" className="sm:w-auto" onClick={() => window.location.reload()}>
          {t("common.tryAgain")}
        </Button>
      </MessageCard>
    </main>
  );
}
