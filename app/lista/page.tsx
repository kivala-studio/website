import { PublicShell } from "../public-shell";
import AccountGate from "../components/account-gate";
import { getMarket } from "../../lib/public-data";
import Watchlist from "./watchlist";
export const metadata = {
  title: "A minha lista | invest.ao",
  robots: { index: false },
};
export default async function Page() {
  const result = await getMarket();
  return (
    <PublicShell>
      <header className="page-heading">
        <p className="eyebrow">OS TEUS INTERESSES</p>
        <h1>A minha lista.</h1>
        <p>Os instrumentos que queres acompanhar, sempre à mão.</p>
      </header>
      <AccountGate feature="A tua lista">
        <Watchlist market={result.data} />
      </AccountGate>
    </PublicShell>
  );
}
