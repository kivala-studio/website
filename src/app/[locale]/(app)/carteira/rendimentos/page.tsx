import { requestTime } from "@/data/clock";
import { getRecentDividends } from "@/data/market/public-cache";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { IncomeView } from "@/features/portfolio/income-view";
import { SIGNED_IN_PAGE, signedInMetadata } from "@/features/shell/placeholder-page";
import { cn } from "@/ui/cn";

export const generateMetadata = signedInMetadata("income.title");

export default async function IncomePage() {
  const now = requestTime();
  const [rows, dividends] = await Promise.all([catalogueRows(now), getRecentDividends(now).catch(() => [])]);
  return (
    <main id="main" className={cn(SIGNED_IN_PAGE, "flex flex-col gap-4")}>
      <IncomeView rows={rows ?? []} renderedAt={now} dividends={dividends.map((item) => ({ ...item, amountPerShare: item.amountPerShare.toString() }))} />
    </main>
  );
}
