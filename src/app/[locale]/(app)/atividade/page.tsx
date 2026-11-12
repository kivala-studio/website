import { requestTime } from "@/data/clock";
import { ActivityCenter } from "@/features/activity/activity-center";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { SIGNED_IN_PAGE, signedInMetadata } from "@/features/shell/placeholder-page";
import { OfflineBanner } from "@/ui/components/feedback";
import { cn } from "@/ui/cn";

export const generateMetadata = signedInMetadata("common.activity");

/** Atividade (iOS `ActivityCenterView`): the inbox, and the web's notification channel. */
export default async function ActivityPage() {
  const now = requestTime();
  const rows = await catalogueRows(now);
  const symbols = Object.fromEntries((rows ?? []).map((row) => [row.id, row.symbol]));
  return (
    <main id="main" className={cn(SIGNED_IN_PAGE, "flex flex-col gap-4")}>
      <OfflineBanner />
      <ActivityCenter symbols={symbols} renderedAt={now} />
    </main>
  );
}
