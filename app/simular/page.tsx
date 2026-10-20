import { PublicShell } from "../public-shell";
import { getMarket } from "../../lib/public-data";
import Simulator from "./simulator";
export const metadata = { title: "Simulador de investimentos | invest.ao" };
export default async function Page() {
  const market = await getMarket();
  return (
    <PublicShell>
      <header className="page-heading">
        <p className="eyebrow">O TEMPO TAMBÉM CONTA</p>
        <h1>Explora possibilidades.</h1>
        <p>
          Uma hipótese tua. Uma projecção transparente. Sem mexer na carteira.
        </p>
      </header>
      <Simulator market={market.data} />
    </PublicShell>
  );
}
