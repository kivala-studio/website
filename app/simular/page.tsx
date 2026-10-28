import { PublicShell } from "../public-shell";
import { getMarket } from "../../lib/public-data";
import Simulator from "./simulator";
export const metadata = { title: "Simulador de investimentos | invest.ao" };
export default async function Page() {
  const market = await getMarket();
  return (
    <PublicShell>
      <header className="page-heading">
        <h1>Explora possibilidades.</h1>
      </header>
      <Simulator market={market.data} />
    </PublicShell>
  );
}
