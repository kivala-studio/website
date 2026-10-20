import { PublicShell } from "../public-shell";
import { getMarket, read } from "../../lib/public-data";
import { DataError } from "../public-content";
import AccountGate from "../components/account-gate";
import Wraps, { type Window } from "./wraps";
import DevelopmentState from "../components/development-state";
export const metadata = { title: "Resumos do mercado | invest.ao" };
export default async function Page() {
  const [windows, market] = await Promise.all([
    read<Window[]>("rpc/get_available_market_wraps").catch(() => null),
    getMarket(),
  ]);
  const now = new Date().getTime();
  const available = (windows || []).filter(
    (w) => Date.parse(w.available_at) <= now && Date.parse(w.expires_at) > now,
  );
  return (
    <PublicShell>
      <header className="page-heading">
        <p className="eyebrow">O MERCADO, COM CONTEXTO</p>
        <h1>Faz o balanço.</h1>
        <p>
          Revisita os períodos concluídos a partir de fechos e fontes
          verificadas.
        </p>
      </header>
      <DevelopmentState feature="richerSummaries" compact />
      {windows === null && <DataError content="os períodos disponíveis" />}
      <AccountGate feature="Os resumos do mercado">
        <Wraps windows={available} market={market.data} />
      </AccountGate>
    </PublicShell>
  );
}
