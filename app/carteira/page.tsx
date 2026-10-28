import { PublicShell } from "../public-shell";
import AccountGate from "../components/account-gate";
import { getMarket } from "../../lib/public-data";
import Portfolio from "./portfolio";
export const metadata = {
  title: "Carteira | invest.ao",
  robots: { index: false },
};
export default async function Page() {
  const market = await getMarket();
  return (
    <PublicShell>
      <header className="page-heading">
        <h1>A tua carteira.</h1>
      </header>
      <AccountGate feature="A tua carteira">
        <Portfolio market={market.data} />
      </AccountGate>
    </PublicShell>
  );
}
