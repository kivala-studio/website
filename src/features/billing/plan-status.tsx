"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { SubscriptionAccess } from "@/domain/account/access";
import type { Format } from "@/domain/format";
import { luandaCivilDate } from "@/domain/format/date";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

/** The last day of paid Plus as a Luanda civil day: `22 de dezembro de 2026`. */
export const passEndDate = (instant: string, format: Format) => format.maturity(luandaCivilDate(Date.parse(instant)));

/** Plus with no end date: lifetime (the access document leaves `plusUntil` empty only for Free and lifetime Plus). */
export const isLifetimePlus = (access: SubscriptionAccess | null) => access?.isPlus === true && access.plusUntil === null;

/**
 * The page's header: `invest.ao Plus`, then the member's plan as the access document has it (Free; Plus and until
 * when; lifetime Plus), and an action beside it. Nothing is guessed when access could not be read.
 */
export function PlanStatus({ access, action }: { access: SubscriptionAccess | null; action?: ReactNode }) {
  const t = useTranslations();
  const format = useFormat();
  const title = !access
    ? null
    : !access.isPlus
      ? t("subscriptions.freeSelection.title")
      : isLifetimePlus(access)
        ? t("subscriptions.status.lifetimeTitle")
        : t("subscriptions.status.activeTitle");
  const until = access?.isPlus && access.plusUntil ? t("site.plans.until", { date: passEndDate(access.plusUntil, format) }) : null;
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-display text-primary-text">{t("subscriptions.management.plusTitle")}</h1>
        {title ? (
          <div className="flex flex-col gap-0.5" data-testid="plan-status" data-plan={access?.isPlus ? "plus" : "free"}>
            <p className="flex items-center gap-2 text-body font-semibold text-primary-text">
              {access?.isPlus ? <Icon name="check-circle" className="shrink-0 text-accent" /> : null}
              {title}
            </p>
            {until ? <p className="text-secondary text-secondary-text">{until}</p> : null}
          </div>
        ) : null}
      </div>
      {action}
    </header>
  );
}
