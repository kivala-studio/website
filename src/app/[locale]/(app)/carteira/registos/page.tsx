import { requestTime } from "@/data/clock";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { RecordsView } from "@/features/portfolio/position-view";
import { SIGNED_IN_PAGE, signedInMetadata } from "@/features/shell/placeholder-page";
import { cn } from "@/ui/cn";

export const generateMetadata = signedInMetadata("common.records");

export default async function RecordsPage() {
  const now = requestTime();
  const rows = await catalogueRows(now);
  return (
    <main id="main" className={cn(SIGNED_IN_PAGE, "flex flex-col gap-4")}>
      <RecordsView rows={rows ?? []} renderedAt={now} />
    </main>
  );
}
