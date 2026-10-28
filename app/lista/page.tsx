import { PublicShell } from "../public-shell";
import AccountGate from "../components/account-gate";
import { getMarket } from "../../lib/public-data";
import Watchlist from "./watchlist";
export const metadata = {
  title: "A minha lista | invest.ao",
  robots: { index: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ instrumento?: string }>;
}) {
  const result = await getMarket();
  const { instrumento } = await searchParams;
  const initialSymbol =
    result.data?.securities.find((s) => s.id === instrumento)?.symbol || "";
  return (
    <PublicShell>
      <header className="page-heading">
        <h1>A minha lista.</h1>
      </header>
      <AccountGate feature="A tua lista">
        <Watchlist market={result.data} initialQuery={initialSymbol} />
      </AccountGate>
    </PublicShell>
  );
}
