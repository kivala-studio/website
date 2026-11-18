"use client";

import { useTranslations } from "next-intl";

import { MessagePage } from "@/features/site/pages";
import { Button } from "@/ui/components/buttons";

export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  return (
    <MessagePage title={t("errors.generic.title")}>
      <Button onClick={reset} className="sm:w-auto">
        {t("common.tryAgain")}
      </Button>
    </MessagePage>
  );
}
