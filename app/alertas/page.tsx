import { PublicShell } from "../public-shell";
import AccountGate from "../components/account-gate";
import { getMarket } from "../../lib/public-data";
import Alerts from "./alerts";
import DevelopmentState from "../components/development-state";
export const metadata = {
  title: "Alertas | invest.ao",
  robots: { index: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ instrumento?: string }>;
}) {
  const [market, params] = await Promise.all([getMarket(), searchParams]);
  return (
    <PublicShell>
      <header className="page-heading">
        <p className="eyebrow">ACOMPANHAR COM INTENÇÃO</p>
        <h1>Os teus alertas.</h1>
        <p>
          Define um preço ou movimento. Consulta os acontecimentos na
          Actividade.
        </p>
      </header>
      <DevelopmentState feature="webPush" compact />
      <AccountGate feature="Os teus alertas">
        <Alerts
          securities={market.data?.securities || []}
          initial={params.instrumento}
        />
      </AccountGate>
    </PublicShell>
  );
}
