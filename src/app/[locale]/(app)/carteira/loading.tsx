import { DashboardSkeleton } from "@/features/portfolio/portfolio-view";
import { PageHeadingSkeleton } from "@/ui/components/page-skeleton";

/**
 * A portfolio page on its way (the overview, records, income, a position), beside the rail, which stays: the title
 * row (the portfolio's name is data) with the privacy button, then the value card and the positions, announced as
 * the portfolio loading (`DashboardSkeleton`, as `PortfolioView` shows while the ledger loads).
 */
export default function Loading() {
  return (
    <main id="main" aria-busy="true" className="flex min-w-0 flex-col gap-6">
      <PageHeadingSkeleton actions={1} />
      <DashboardSkeleton />
    </main>
  );
}
