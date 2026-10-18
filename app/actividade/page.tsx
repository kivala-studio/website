import { PublicShell } from "../public-shell";
import AccountGate from "../components/account-gate";
import Activity from "./activity";
export const metadata = {
  title: "Actividade | invest.ao",
  robots: { index: false },
};
export default function Page() {
  return (
    <PublicShell>
      <header className="page-heading">
        <p className="eyebrow">O QUE ACONTECEU</p>
        <h1>A tua actividade.</h1>
        <p>Alertas, movimentos e resumos da tua conta, nos últimos 28 dias.</p>
      </header>
      <AccountGate feature="A tua actividade">
        <Activity />
      </AccountGate>
    </PublicShell>
  );
}
