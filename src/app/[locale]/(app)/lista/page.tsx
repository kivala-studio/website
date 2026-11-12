import { requestTime } from "@/data/clock";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { SIGNED_IN_PAGE, signedInMetadata } from "@/features/shell/placeholder-page";
import { WatchlistView } from "@/features/watchlist/watchlist-view";
import { OfflineBanner } from "@/ui/components/feedback";
import { cn } from "@/ui/cn";

export const generateMetadata = signedInMetadata("common.yourWatchlist");

/** A tua lista (iOS `WatchlistView`): rows from the tab's market store, identity from the server catalogue. */
export default async function WatchlistPage() {
  const now = requestTime();
  const rows = await catalogueRows(now);
  return (
    <main id="main" className={cn(SIGNED_IN_PAGE, "flex flex-col gap-4")}>
      <OfflineBanner />
      <WatchlistView rows={rows ?? []} renderedAt={now} />
    </main>
  );
}
