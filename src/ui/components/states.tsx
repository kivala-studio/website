"use client";

import { useTranslations } from "next-intl";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../cn";
import { Icon, type IconName } from "../icons/icon";
import { useEntrance } from "../motion/use-entrance";

/** A 1 em ring that turns; it fades in, so a quick request never flashes it. Still with reduced motion. */
export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cn("motion-spin inline-block size-[1em] rounded-full border-2 border-current border-r-transparent", className)} />;
}

/** States that replace content on the page fade in; the ones the server rendered are simply there. */
function useStateEntrance() {
  return useEntrance() ? "motion-fade-in" : undefined;
}

/**
 * Content that replaces a skeleton or another state inside a component the server rendered (a list arriving, the
 * loaded view after `LoadingState`): it fades in (`rise`: and rises, `motion-presence`) when it mounts after
 * hydration, and is simply there when the server rendered it. A plain `div`: give it the layout classes the content
 * needs, or wrap one full-width child.
 */
export function FadeIn({ rise = false, className, ...props }: HTMLAttributes<HTMLDivElement> & { rise?: boolean }) {
  const entrance = useEntrance();
  return <div {...props} className={cn(entrance && (rise ? "motion-presence" : "motion-fade-in"), className)} />;
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
  const entrance = useStateEntrance();
  return (
    <div role="status" className={cn("flex min-h-60 flex-col items-center justify-center gap-4 px-6 text-center", entrance)}>
      <Spinner className="text-[2rem] text-accent" />
      <p className="text-secondary text-secondary-text">{text}</p>
    </div>
  );
}

export function EmptyState({ title, message, icon = "info", action }: { title: string; message?: string; icon?: IconName; action?: ReactNode }) {
  const entrance = useStateEntrance();
  return (
    <div className={cn("flex flex-col items-center gap-4", entrance)}>
      <StateBody icon={icon} tone="neutral" title={title} message={message} />
      {action}
    </div>
  );
}

export function ErrorState({ title, message, action }: { title?: string; message: string; action?: ReactNode }) {
  const t = useTranslations("components.emptyState");
  const entrance = useStateEntrance();
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-5", entrance)}>
      <StateBody icon="warning" tone="warning" title={title ?? t("dataUnavailable")} message={message} />
      {action}
    </div>
  );
}

/** A grey pulsing block shaped like what will load. Small corners unless `className` gives its own (`rounded-full` for a logo). */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("motion-pulse block bg-action-surface", !className?.includes("rounded-") && "rounded-small", className)} />;
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

/** A section keeps its place while its data loads or after it fails; the failure fades in over the skeleton's place. */
export function SectionPlaceholder({ title, failed = false, onRetry }: { title: string; failed?: boolean; onRetry?: () => void }) {
  const t = useTranslations();
  return (
    <section aria-label={title} aria-busy={!failed} className="flex min-h-24 flex-col gap-3">
      <h3 className="text-secondary font-semibold text-primary-text">{title}</h3>
      {failed ? (
        <PlaceholderFailure message={t("components.placeholder.loadFailed")} retry={onRetry ? t("common.tryAgain") : undefined} onRetry={onRetry} />
      ) : (
        <>
          <Skeleton className="h-7 w-35" />
          <Skeleton className="h-4 w-full" />
        </>
      )}
    </section>
  );
}

function PlaceholderFailure({ message, retry, onRetry }: { message: string; retry?: string; onRetry?: () => void }) {
  const entrance = useStateEntrance();
  return (
    <div className={cn("flex flex-col gap-3", entrance)}>
      <p className="text-caption text-secondary-text">{message}</p>
      {retry ? (
        <button type="button" onClick={onRetry} className="motion-press min-h-11 self-start text-secondary text-accent">
          {retry}
        </button>
      ) : null}
    </div>
  );
}

