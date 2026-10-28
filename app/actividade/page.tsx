import { PublicShell } from "../public-shell";
import AccountGate from "../components/account-gate";
import Activity from "./activity";
import DevelopmentState from "../components/development-state";
export const metadata = {
  title: "Actividade | invest.ao",
  robots: { index: false },
};
export default function Page() {
  return (
    <PublicShell>
      <header className="page-heading">
        <h1>A tua actividade.</h1>
        <p>Alertas, movimentos e resumos da tua conta, nos últimos 28 dias.</p>
      </header>
      <DevelopmentState feature="webPush" compact />
      <AccountGate feature="A tua actividade">
        <Activity />
      </AccountGate>
    </PublicShell>
  );
}
