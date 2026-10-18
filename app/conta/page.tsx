import AppleDeletionResult from "./apple-deletion-result";
import { PublicShell } from "../public-shell";
import { getMarket } from "../../lib/public-data";
import AccountPanel from "./panel";
export const metadata = {
  title: "A minha conta | invest.ao",
  robots: { index: false },
};
export default async function Page() {
  const market = await getMarket();
  return (
    <PublicShell>
      <header className="page-heading">
        <p className="eyebrow">O TEU ESPAÇO</p>
        <h1>A minha conta.</h1>
        <p>Uma conta. O mesmo mercado, no iPhone e na web.</p>
      </header>
      <AppleDeletionResult />
      <AccountPanel securities={market.data?.securities || []} />
    </PublicShell>
  );
}
