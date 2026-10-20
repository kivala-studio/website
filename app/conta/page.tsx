import Link from "next/link";
import AppleDeletionResult from "./apple-deletion-result";
import { PublicShell } from "../public-shell";
import { getMarket } from "../../lib/public-data";
import AccountPanel from "./panel";
export const metadata = {
  title: "A minha conta | invest.ao",
  robots: { index: false },
};
export default async function Page({ searchParams }: PageProps<"/conta">) {
  const params = await searchParams;
  // Deletion receipts remain verifiable after the deleted session stops working.
  if (params.appleDeletion === "verified" || params.appleDeletion === "invalid") {
    return (
      <PublicShell>
        <header className="page-heading"><h1>Estado da tua conta.</h1></header>
        <AppleDeletionResult />
        <Link className="text-link" href="/">Voltar ao site</Link>
      </PublicShell>
    );
  }
  const market = await getMarket();
  return (
    <PublicShell>
      <header className="page-heading">
        <p className="eyebrow">O TEU ESPAÇO</p>
        <h1>A minha conta.</h1>
        <p>Uma conta. O mesmo mercado, no iPhone e na web.</p>
      </header>
      <AppleDeletionResult />
      <AccountPanel securities={market.data?.securities || []} />
    </PublicShell>
  );
}
