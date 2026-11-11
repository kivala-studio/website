"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "../cn";
import { Icon, type IconName } from "../icons/icon";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-[1em] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none",
        className,
      )}
    />
  );
}

function StateBody({ icon, tone, title, message }: { icon: IconName; tone: "neutral" | "warning"; title: string; message?: string }) {
  return (
    <div className="flex min-h-55 flex-col items-center justify-center gap-3 px-6 text-center">
      <span
        className={cn(
          "flex size-13 items-center justify-center rounded-full text-[1.75rem]",
          tone === "warning" ? "bg-warning/12 text-warning" : "bg-secondary-text/12 text-secondary-text",
        )}
      >
        <Icon name={icon} />
      </span>
      <h3 className="text-section text-primary-text">{title}</h3>
      {message ? <p className="text-secondary text-secondary-text">{message}</p> : null}
    </div>
  );
}

export function LoadingState({ message }: { message?: string }) {
  const t = useTranslations("common");
  const text = message ?? t("loadingMarket");
  return (
    <div role="status" className="flex min-h-60 flex-col items-center justify-center gap-4 px-6 text-center">
      <Spinner className="text-[2rem] text-accent" />
      <p className="text-secondary text-secondary-text">{text}</p>
    </div>
  );
}

export function EmptyState({ title, message, icon = "info", action }: { title: string; message?: string; icon?: IconName; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <StateBody icon={icon} tone="neutral" title={title} message={message} />
      {action}
    </div>
  );
}

export function ErrorState({ title, message, action }: { title?: string; message: string; action?: ReactNode }) {
  const t = useTranslations("components.emptyState");
  return (
    <div role="alert" className="flex flex-col items-center gap-5">
      <StateBody icon="warning" tone="warning" title={title ?? t("dataUnavailable")} message={message} />
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("motion-pulse block rounded-small bg-action-surface", className)} />;
}

/** Placeholder for an asset row while its data loads. */
export function InstrumentRowSkeleton() {
  return (
    <div aria-hidden className="flex min-h-20 items-center gap-3 py-3">
      <Skeleton className="size-12 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3.5 w-40" />
      </div>
      <Skeleton className="h-7 w-20" />
    </div>
  );
}

/** Chart loading: a shimmer of the chart's own height. Never fake data. */
export function ChartShimmer({ className }: { className?: string }) {
  return <span aria-hidden className={cn("motion-shimmer block h-46 w-full rounded-medium bg-action-surface/40", className)} />;
}

/** A section keeps its place while its data loads or after it fails. */
export function SectionPlaceholder({ title, failed = false, onRetry }: { title: string; failed?: boolean; onRetry?: () => void }) {
  const t = useTranslations();
  return (
    <section aria-label={title} aria-busy={!failed} className="flex min-h-24 flex-col gap-3">
      <h3 className="text-secondary font-semibold text-primary-text">{title}</h3>
      {failed ? (
        <>
          <p className="text-caption text-secondary-text">{t("components.placeholder.loadFailed")}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="min-h-11 self-start text-secondary text-accent">
              {t("common.tryAgain")}
            </button>
          ) : null}
        </>
      ) : (
        <>
          <Skeleton className="h-7 w-35" />
          <Skeleton className="h-4 w-full" />
        </>
      )}
    </section>
  );
}
