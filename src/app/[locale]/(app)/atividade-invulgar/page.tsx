import { requestTime } from "@/data/clock";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { SIGNED_IN_PAGE, signedInMetadata } from "@/features/shell/placeholder-page";
import { UnusualActivityView } from "@/features/unusual-activity/unusual-activity-view";
import { AreaMessages } from "@/i18n/area-messages";
import { OfflineBanner } from "@/ui/components/feedback";
import { cn } from "@/ui/cn";

export const generateMetadata = signedInMetadata("unusualActivity.title");

/** Atividade invulgar (iOS `UnusualActivityView`): rows from the tab's market store, identity from the server catalogue. */
export default async function UnusualActivityPage() {
  const rows = await catalogueRows(requestTime());
  return (
    <main id="main" className={cn(SIGNED_IN_PAGE, "flex flex-col gap-4")}>
      <OfflineBanner />
      <AreaMessages area="unusualActivity">
        <UnusualActivityView rows={rows ?? []} />
      </AreaMessages>
    </main>
  );
}
