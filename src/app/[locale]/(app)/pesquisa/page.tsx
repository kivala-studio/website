import { requestTime } from "@/data/clock";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { SearchPanel } from "@/features/search/search-panel";
import { SignedInPage, signedInMetadata } from "@/features/shell/placeholder-page";

export const generateMetadata = signedInMetadata("common.search");

export default async function Page() {
  const now = requestTime();
  const rows = await catalogueRows(now);
  return (
    <SignedInPage titleKey="common.search" className="max-w-3xl">
      <SearchPanel rows={rows ?? []} renderedAt={now} autoFocus />
    </SignedInPage>
  );
}
