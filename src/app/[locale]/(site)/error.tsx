"use client";

import { useTranslations } from "next-intl";

import { ReadingPage } from "@/features/site/pages";
import { Button } from "@/ui/components/buttons";

export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  return (
    <ReadingPage title={t("errors.generic.title")}>
      <Button onClick={reset} className="sm:w-auto! sm:self-start">
        {t("common.tryAgain")}
      </Button>
    </ReadingPage>
  );
}
