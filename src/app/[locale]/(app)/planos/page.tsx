import { PlansView } from "@/features/billing/plans-view";
import { SIGNED_IN_PAGE, signedInMetadata } from "@/features/shell/placeholder-page";
import { AreaMessages } from "@/i18n/area-messages";

export const generateMetadata = signedInMetadata("subscriptions.management.plusTitle");

/** Planos: the member's plan and the prepaid Plus web pass, read and paid in the browser for this account. */
export default function PlansPage() {
  return (
    <main id="main" className={SIGNED_IN_PAGE}>
      <AreaMessages area="plans">
        <PlansView />
      </AreaMessages>
    </main>
  );
}
