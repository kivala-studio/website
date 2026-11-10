import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "@/ui/cn";
import { PageHeading } from "@/ui/components/layout";
import { Icon } from "@/ui/icons/icon";

import { PAGE_WIDTH } from "./chrome";
import { SUPPORT_EMAIL } from "./site";

/** Single-column reading page: legal, support, account deletion, invites. */
export function ReadingPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main id="main" className={cn(PAGE_WIDTH, "pt-6 pb-16")}>
      <div className="flex max-w-3xl flex-col gap-8">
        <PageHeading title={title} />
        {children}
      </div>
    </main>
  );
}

export function SupportContact() {
  const t = useTranslations("site.legal");
  return (
    <section aria-labelledby="contact" className="flex flex-col gap-1">
      <h2 id="contact" className="text-section text-primary-text">
        {t("contact")}
      </h2>
      <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-11 items-center self-start text-body font-semibold text-accent underline underline-offset-4">
        {SUPPORT_EMAIL}
      </a>
    </section>
  );
}

/**
 * Legal and help pages until the owner supplies the text: a clearly marked draft notice and the support contact.
 * `data-draft` lets tests and reviewers find every page that still needs approved text.
 */
export function DraftLegalPage({ title }: { title: string }) {
  const t = useTranslations("site.legal");
  return (
    <ReadingPage title={title}>
      <p data-draft className="flex items-start gap-3 rounded-medium bg-elevated-background px-4 py-3 text-body text-primary-text">
        <Icon name="warning" className="mt-0.5 text-warning" />
        <span>{t("draft")}</span>
      </p>
      <SupportContact />
    </ReadingPage>
  );
}
