"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/ui/components/buttons";
import { EmptyState } from "@/ui/components/states";

/** Replaces every page while the `web-maintenance` flag is on. */
export function MaintenanceScreen() {
  const t = useTranslations();
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <EmptyState
        icon="warning"
        title={t("appAvailability.maintenance.title")}
        message={t("appAvailability.maintenance.message")}
        action={
          <Button kind="secondary" className="max-w-80" onClick={() => window.location.reload()}>
            {t("common.tryAgain")}
          </Button>
        }
      />
    </main>
  );
}
