import { requestTime } from "@/data/clock";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { RecordsView } from "@/features/portfolio/position-view";
import { signedInMetadata } from "@/features/shell/placeholder-page";

export const generateMetadata = signedInMetadata("common.records");

export default async function RecordsPage() {
  const now = requestTime();
  const rows = await catalogueRows(now);
  return (
    <main id="main" className="flex min-w-0 flex-col gap-4">
      <RecordsView rows={rows ?? []} renderedAt={now} />
    </main>
  );
}
