import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { Icon, type IconName } from "@/ui/icons/icon";

/*
 * Settings rows (iOS `SettingsView`): titled groups of rows divided by hairlines. A row opens something
 * (chevron), shows a value, or holds a control. Usable without JavaScript.
 */

const ROW = "flex min-h-12 w-full items-center gap-3 py-2 text-left";

export function SettingsGroup({ id, title, children, className }: { id: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("flex max-w-2xl flex-col gap-2", className)}>
      <h2 id={id} className="text-section text-primary-text">
        {title}
      </h2>
      <div className="flex flex-col divide-y divide-hairline rounded-large bg-card-background px-4 lg:panel">{children}</div>
    </section>
  );
}

function Leading({ icon }: { icon?: IconName }) {
  return icon ? <Icon name={icon} className="shrink-0 text-secondary-text" /> : null;
}

export function LinkRow({ href, icon, label, value, external = false }: { href: string; icon?: IconName; label: string; value?: string; external?: boolean }) {
  const content = (
    <>
      <Leading icon={icon} />
      <span className="min-w-0 flex-1 text-body text-primary-text">{label}</span>
      {value ? <span className="text-secondary text-secondary-text">{value}</span> : null}
      <Icon name={external ? "arrow-up-right" : "chevron-right"} scale="s" className="shrink-0 text-tertiary-text" />
    </>
  );
  return external ? (
    <a href={href} className={ROW}>
      {content}
    </a>
  ) : (
    <Link href={href} prefetch={false} className={ROW}>
      {content}
    </Link>
  );
}

export function ValueRow({ icon, label, children }: { icon?: IconName; label: string; children: ReactNode }) {
  return (
    <div className={cn(ROW, "flex-wrap")}>
      <Leading icon={icon} />
      <span className="min-w-0 flex-1 text-body text-primary-text">{label}</span>
      <span className="min-w-0 text-right text-secondary text-secondary-text [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

/** A row whose control sits under the label on phones and beside it on wider screens. */
export function ControlRow({ icon, label, children }: { icon?: IconName; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3">
      <span className="flex min-w-0 flex-1 items-center gap-3 text-body text-primary-text">
        <Leading icon={icon} />
        {label}
      </span>
      <div className="sm:w-80">{children}</div>
    </div>
  );
}

/** A text page of the iOS app, here an expandable row. */
export function DisclosureRow({ icon, label, children }: { icon?: IconName; label: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className={cn(ROW, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
        <Leading icon={icon} />
        <span className="min-w-0 flex-1 text-body text-primary-text">{label}</span>
        <Icon name="chevron-down" scale="s" className="shrink-0 text-tertiary-text transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-2 pb-4 text-secondary text-secondary-text">{children}</div>
    </details>
  );
}
