import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { LESSONS } from "@/features/learn/lessons";
import { DashboardSkeleton } from "@/features/portfolio/dashboard-skeleton";
import { HeroPanel } from "@/features/site/home";
import { ReadingPageSkeleton } from "@/features/site/pages";
import { cn } from "@/ui/cn";
import { Card, PAGE_CONTAINER, READING_COLUMN } from "@/ui/components/layout";
import { CardSkeleton, PageHeadingSkeleton, PageSkeleton, PanelSkeleton, RowsSkeleton, TableSkeleton, TitleSkeleton } from "@/ui/components/page-skeleton";
import { ChartShimmer, Skeleton } from "@/ui/components/states";
import { Icon } from "@/ui/icons/icon";

/*
 * Every route's skeleton, in one module the server (`loading.tsx`) and the browser (`PendingPage`, while a page
 * that was not prefetched is on its way) both render, so the two are the same element for element. Each is what
 * the route's `loading.tsx` shows inside its layouts; the market's and the portfolio's sit in those layouts' `<main>`
 * and grid (`MARKET_PAGE`, `PORTFOLIO_PAGE`).
 */

/** A signed-in page's `<main>`: the shared page column with the app's top and bottom spacing. */
export const SIGNED_IN_PAGE = cn(PAGE_CONTAINER, "pt-4 pb-16 lg:pt-8");

/** The market pages' `<main>` (`/mercado` and below). */
export const MARKET_PAGE = cn(PAGE_CONTAINER, "pt-4 pb-16 lg:pt-6");

/** The portfolio area: its rail on the left from 1024 px (a strip on top below), the page beside it. */
export const PORTFOLIO_PAGE = cn(SIGNED_IN_PAGE, "flex flex-col gap-6 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-8");

/**
 * A signed-in page on its way, in the app shell: the page column (`narrow`: the reading column), the title row
 * (`title`, or its place) with `actions` icon-button places and a `pill`, then `children` (two cards by default).
 */
export function SignedInPageSkeleton({
  title,
  narrow = false,
  actions = 0,
  pill = false,
  className,
  children,
}: {
  title?: string;
  narrow?: boolean;
  actions?: number;
  pill?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <PageSkeleton as="main" className={SIGNED_IN_PAGE}>
      <div className={cn("flex flex-col gap-6", narrow ? READING_COLUMN : "w-full", className)}>
        <PageHeadingSkeleton title={title} actions={actions} pill={pill} />
        {children ?? (
          <>
            <CardSkeleton lines={4} />
            <CardSkeleton lines={2} />
          </>
        )}
      </div>
    </PageSkeleton>
  );
}

/** Início: the title and refresh, the overview card and the movers beside the watchlist and the news (`HomeView`). */
export function HomeSkeleton() {
  const t = useTranslations();
  return (
    <SignedInPageSkeleton title={t("common.home")} actions={1}>
      <div aria-hidden className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
          <Card className="flex flex-col gap-5 max-lg:order-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-11 w-full" />
          </Card>
          <PanelSkeleton className="max-lg:order-3">
            <Skeleton className="h-11 w-full rounded-medium" />
            <RowsSkeleton rows={3} />
          </PanelSkeleton>
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-6">
          <PanelSkeleton className="max-lg:order-2">
            <RowsSkeleton rows={3} />
          </PanelSkeleton>
          <PanelSkeleton className="max-lg:order-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </PanelSkeleton>
        </div>
      </div>
    </SignedInPageSkeleton>
  );
}

/**
 * A tua lista (`WatchlistView`): the title over the count, refresh and groups, the add button (full width on
 * phones), the plan line, then the table.
 */
export function WatchlistSkeleton() {
  const t = useTranslations();
  return (
    <PageSkeleton as="main" className={cn(SIGNED_IN_PAGE, "flex flex-col gap-4")}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-display text-primary-text">{t("common.yourWatchlist")}</h1>
          <span aria-hidden className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-36" />
          </span>
        </div>
        <div aria-hidden className="flex items-center gap-2">
          <Skeleton className="size-12 rounded-full desk:size-11" />
          <Skeleton className="h-11 w-20 rounded-full" />
        </div>
        <Skeleton className="h-14 w-full rounded-full sm:w-56 desk:h-11" />
      </div>
      <span aria-hidden className="flex h-5 items-center">
        <Skeleton className="h-3.5 w-56" />
      </span>
      <TableSkeleton rows={4} />
    </PageSkeleton>
  );
}

/**
 * A portfolio page (the overview, records, income, a position), beside the rail: the title row (the portfolio's
 * name is data) with the privacy button, then the value card and the positions (`DashboardSkeleton`).
 */
export function PortfolioSkeleton() {
  return (
    <main id="main" aria-busy="true" className="flex min-w-0 flex-col gap-6">
      <PageHeadingSkeleton actions={1} />
      <DashboardSkeleton />
    </main>
  );
}

/** Atividade: the title and its actions, the filter tabs and the list (`ActivityCenter`). */
export function ActivitySkeleton() {
  const t = useTranslations();
  return (
    <SignedInPageSkeleton title={t("common.activity")} actions={2} pill narrow className="gap-4">
      <div aria-hidden className="flex min-h-12 items-center gap-6 border-b border-hairline desk:min-h-11">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Card flush aria-hidden className="flex flex-col divide-y divide-hairline px-5 desk:px-6">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="flex flex-col gap-2 py-4">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </Card>
    </SignedInPageSkeleton>
  );
}

/** Atividade invulgar: the title and refresh, then the session's instruments (`UnusualActivityView`). */
export function UnusualActivitySkeleton() {
  const t = useTranslations();
  return (
    <SignedInPageSkeleton title={t("unusualActivity.title")} actions={1} narrow className="gap-4">
      <CardSkeleton>
        <RowsSkeleton rows={4} />
      </CardSkeleton>
    </SignedInPageSkeleton>
  );
}

/** Settings and the account page: the reading column of setting groups. */
export function SettingsSkeleton() {
  return (
    <SignedInPageSkeleton narrow>
      <CardSkeleton lines={3} />
      <CardSkeleton lines={2} />
      <CardSkeleton lines={3} />
    </SignedInPageSkeleton>
  );
}

/** Pesquisa: the title, the field and the first results (`SearchPanel`). */
export function SearchSkeleton() {
  const t = useTranslations();
  return (
    <SignedInPageSkeleton title={t("common.search")} narrow>
      <Skeleton className="h-12 w-full rounded-medium desk:h-11" />
      <RowsSkeleton rows={5} />
    </SignedInPageSkeleton>
  );
}

/** A semana: the title and the privacy button, then the days (`WeekAheadView`). */
export function WeekSkeleton() {
  const t = useTranslations();
  return (
    <SignedInPageSkeleton title={t("weekAhead.summary.title")} actions={1} narrow>
      <CardSkeleton lines={3} />
      <CardSkeleton lines={3} />
      <CardSkeleton lines={2} />
    </SignedInPageSkeleton>
  );
}

/** O simulador: the title, the result beside the inputs from 1024 px (`Simulator`). */
export function SimulatorSkeleton() {
  const t = useTranslations();
  return (
    <SignedInPageSkeleton title={t("common.simulateInvestment")}>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-x-8">
        <CardSkeleton title={false} className="gap-4">
          <Skeleton className="h-12 w-56" />
          <ChartShimmer className="h-56" />
        </CardSkeleton>
        <CardSkeleton lines={5} />
      </div>
    </SignedInPageSkeleton>
  );
}

/** A recap. */
export function RecapSkeleton() {
  const t = useTranslations();
  return <SignedInPageSkeleton title={t("home.contextCard.availableSummaries")} />;
}

/** A new admission: the way back, the issuer's logo and name, then the admission's cards. */
export function AdmissionSkeleton() {
  const t = useTranslations();
  return (
    <PageSkeleton className={cn(READING_COLUMN, "gap-6")}>
      <span aria-hidden className="-mb-2 -ml-1 inline-flex min-h-11 items-center gap-1 self-start px-1 text-secondary font-semibold text-accent">
        <Icon name="chevron-left" />
        {t("common.market")}
      </span>
      <div aria-hidden className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full desk:size-12" />
        <div className="flex min-w-0 flex-col gap-1">
          <TitleSkeleton />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <CardSkeleton lines={3} />
      <CardSkeleton lines={2} />
    </PageSkeleton>
  );
}

/** Market information and one update: the reading column of cards. */
export function MarketInformationSkeleton() {
  return (
    <PageSkeleton className={cn(READING_COLUMN, "gap-6")}>
      <PageHeadingSkeleton />
      <CardSkeleton lines={3} />
      <CardSkeleton lines={4} />
    </PageSkeleton>
  );
}

/** The landing: the hero panel's place, one window tall, its shapes drifting, under the site header. */
export function LandingSkeleton() {
  return (
    <PageSkeleton as="main">
      <HeroPanel />
    </PageSkeleton>
  );
}

/** Aprender: the title and the seven lesson rows' places. */
export function LessonsSkeleton() {
  const t = useTranslations();
  return (
    <ReadingPageSkeleton title={t("learn.title")}>
      <ul aria-hidden className="panel flex flex-col overflow-hidden">
        {LESSONS.map((lesson) => (
          <li key={lesson.id} className="flex min-h-15 items-center gap-4 border-b border-hairline px-5 py-3 last:border-b-0 desk:px-6">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </li>
        ))}
      </ul>
    </ReadingPageSkeleton>
  );
}

/** Notícias: the title, the search field and the first days of the feed (`NewsFeed`). */
export function NewsFeedSkeleton() {
  const t = useTranslations();
  return (
    <ReadingPageSkeleton title={t("common.news")}>
      <Skeleton className="h-12 w-full rounded-medium desk:h-11" />
      <CardSkeleton lines={2} />
      <CardSkeleton lines={4} />
      <CardSkeleton lines={2} />
    </ReadingPageSkeleton>
  );
}

/** A reading page whose title is still to come: an article, a lesson, and any page without its own skeleton. */
export function ReadingSkeleton() {
  return <ReadingPageSkeleton />;
}

export function DeleteAccountSkeleton() {
  const t = useTranslations();
  return <ReadingPageSkeleton title={t("common.deleteAccount")} />;
}

export function PrivacyPolicySkeleton() {
  const t = useTranslations();
  return <ReadingPageSkeleton title={t("common.privacyPolicy")} />;
}

export function SupportSkeleton() {
  const t = useTranslations();
  return <ReadingPageSkeleton title={t("site.legal.supportTitle")} />;
}

export function TermsSkeleton() {
  const t = useTranslations();
  return <ReadingPageSkeleton title={t("site.legal.termsTitle")} />;
}
