import { requestTime } from "@/data/clock";
import { SIGNED_IN_PAGE, signedInMetadata } from "@/features/shell/placeholder-page";
import { WeekAheadView } from "@/features/week-ahead/week-ahead-view";
import { AreaMessages } from "@/i18n/area-messages";
import { OfflineBanner } from "@/ui/components/feedback";
import { cn } from "@/ui/cn";

export const generateMetadata = signedInMetadata("weekAhead.header.navigationTitle");

/** Semana à frente (iOS `WeekAheadView`): the coming week's sourced dates, read in the browser for this account. */
export default function WeekAheadPage() {
  return (
    <main id="main" className={cn(SIGNED_IN_PAGE, "flex flex-col gap-4")}>
      <OfflineBanner />
      <AreaMessages area="weekAhead">
        <WeekAheadView renderedAt={requestTime()} />
      </AreaMessages>
    </main>
  );
}
