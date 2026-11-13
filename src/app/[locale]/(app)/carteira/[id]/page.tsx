import { notFound } from "next/navigation";

import { isUUID } from "@/data/account/session";
import { requestTime } from "@/data/clock";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { PositionView } from "@/features/portfolio/position-view";
import { SIGNED_IN_PAGE, signedInMetadata } from "@/features/shell/placeholder-page";
import { cn } from "@/ui/cn";

export const generateMetadata = signedInMetadata("portfolio.positionDetail.title");

/** One position of the ledger, by instrument id. */
export default async function PositionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUUID(id)) notFound();
  const now = requestTime();
  const rows = await catalogueRows(now);
  return (
    <main id="main" className={cn(SIGNED_IN_PAGE, "flex flex-col gap-4")}>
      <PositionView securityId={id.toLowerCase()} rows={rows ?? []} renderedAt={now} />
    </main>
  );
}
