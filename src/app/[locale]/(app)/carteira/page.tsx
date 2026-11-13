import { requestTime } from "@/data/clock";
import { getBenchmarkQuotes } from "@/data/market/public-cache";
import { toQuoteWire } from "@/domain/portfolio/benchmark";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { PortfolioView } from "@/features/portfolio/portfolio-view";
import { SIGNED_IN_PAGE, signedInMetadata } from "@/features/shell/placeholder-page";
import { OfflineBanner } from "@/ui/components/feedback";
import { cn } from "@/ui/cn";

export const generateMetadata = signedInMetadata("common.portfolio");

/** Carteira (iOS `PortfolioView`): the ledger from the account, identity from the server catalogue. */
export default async function PortfolioPage() {
  const now = requestTime();
  // Public reference rates for the benchmark; null shows a retry there.
  const [rows, quotes] = await Promise.all([catalogueRows(now), getBenchmarkQuotes(now).catch(() => null)]);
  return (
    <main id="main" className={cn(SIGNED_IN_PAGE, "flex flex-col gap-4")}>
      <OfflineBanner />
      <PortfolioView rows={rows ?? []} renderedAt={now} quotes={quotes?.map(toQuoteWire) ?? null} />
    </main>
  );
}
