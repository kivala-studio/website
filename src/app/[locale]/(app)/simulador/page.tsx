import { getTranslations } from "next-intl/server";

import { SIGNED_IN_PAGE, signedInMetadata } from "@/features/shell/placeholder-page";
import { Simulator } from "@/features/simulation/simulator";
import { AreaMessages } from "@/i18n/area-messages";
import { cn } from "@/ui/cn";
import { PageHeading } from "@/ui/components/layout";

export const generateMetadata = signedInMetadata("common.simulateInvestment");

export default async function SimulatorPage() {
  const t = await getTranslations();
  return (
    <main id="main" className={cn(SIGNED_IN_PAGE, "flex flex-col gap-6")}>
      <PageHeading title={t("common.simulateInvestment")} />
      <AreaMessages area="simulation">
        <Simulator />
      </AreaMessages>
    </main>
  );
}
