import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "@/ui/cn";
import { Card, MessageCard, PAGE_CONTAINER, PageHeading, READING_COLUMN } from "@/ui/components/layout";
import { Icon } from "@/ui/icons/icon";

import { SUPPORT_EMAIL } from "./site";

/** A public page's `<main>`: the page container with the same top and bottom spacing as the signed-in pages. */
export const SITE_PAGE = cn(PAGE_CONTAINER, "pt-4 pb-16 lg:pt-8");

/** Single-column reading page (legal, support, account deletion, invites, lessons): the centred 768 px column. */
export function ReadingPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main id="main" className={SITE_PAGE}>
      <div className={cn(READING_COLUMN, "gap-6")}>
        <PageHeading title={title} />
        {children}
      </div>
    </main>
  );
}

/** A page that is one message (not found, an error, a revoked link): a centred card with the title and its action. */
export function MessagePage({ title, message, children }: { title: string; message?: ReactNode; children?: ReactNode }) {
  return (
    <main id="main" className={cn(SITE_PAGE, "flex flex-1 flex-col justify-center lg:pt-16")}>
      <MessageCard className="items-center text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-display text-primary-text">{title}</h1>
          {message}
        </div>
        {children}
      </MessageCard>
    </main>
  );
}

export function SupportContact() {
  const t = useTranslations("site.legal");
  return (
    <Card title={t("contact")} titleId="contact">
      <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-11 items-center self-start text-body font-semibold text-accent underline underline-offset-4">
        {SUPPORT_EMAIL}
      </a>
    </Card>
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
      <p data-draft className="flex items-start gap-3 rounded-card bg-warning/10 px-5 py-4 text-body text-primary-text desk:px-6">
        <Icon name="warning" className="mt-0.5 shrink-0 text-warning" />
        <span>{t("draft")}</span>
      </p>
      <SupportContact />
    </ReadingPage>
  );
}
