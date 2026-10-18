import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "../../public-shell";
import AccountGate from "../../components/account-gate";
import { getMarket } from "../../../lib/public-data";
import Portfolio from "../portfolio";
export const metadata = {
  title: "Posição da carteira | invest.ao",
  robots: { index: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const market = await getMarket();
  const security = market.data?.securities.find((s) => s.id === id);
  return (
    <PublicShell>
      <Link className="back-link" href="/carteira">
        Voltar à carteira
      </Link>
      <header className="page-heading">
        <p className="eyebrow">A TUA POSIÇÃO</p>
        <h1>{security?.symbol || "Registos da posição"}</h1>
        <p>{security?.name}</p>
        {security && (
          <Link className="text-button" href={`/mercado/${id}`}>
            Consultar instrumento e cotação
          </Link>
        )}
      </header>
      <AccountGate feature="A tua posição">
        <Portfolio market={market.data} securityID={id} />
      </AccountGate>
    </PublicShell>
  );
}
