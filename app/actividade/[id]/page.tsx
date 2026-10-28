import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "../../public-shell";
import AccountGate from "../../components/account-gate";
import PortfolioNotification from "./portfolio-notification";
export const metadata = {
  title: "Movimento da carteira | invest.ao",
  robots: { index: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) notFound();
  return (
    <PublicShell>
      <Link className="back-link" href="/actividade">
        Voltar à actividade
      </Link>
      <header className="page-heading">
        <h1>O movimento da sessão.</h1>
      </header>
      <AccountGate feature="O movimento da tua carteira">
        <PortfolioNotification id={id} />
      </AccountGate>
    </PublicShell>
  );
}
