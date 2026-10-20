import { PublicShell } from "../public-shell";
import { getMarket } from "../../lib/public-data";
import Comparison from "./comparison";
import DevelopmentState from "../components/development-state";
import { DataError } from "../public-content";
export const metadata = { title: "Comparar instrumentos | invest.ao" };
export default async function Page() {
  const market = await getMarket();
  return (
    <PublicShell>
      <header className="page-heading">
        <p className="eyebrow">PERSPECTIVA, LADO A LADO</p>
        <h1>Compara o percurso.</h1>
        <p>
          Observa dois instrumentos no mesmo período, a partir de uma base
          comum.
        </p>
      </header>
      <DevelopmentState feature="multiComparison" compact />
      {market.data ? (
        <Comparison securities={market.data.securities} />
      ) : (
        <DataError content="os instrumentos" />
      )}
    </PublicShell>
  );
}
