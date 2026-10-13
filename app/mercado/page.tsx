import { Suspense } from "react";
import { PublicShell, AppInvitation } from "../public-shell";
import { MarketContent, LoadingContent } from "../public-content";
import { Consultation } from "../app-prompt";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata({
  title: "Mercado | invest.ao",
  description:
    "Consulta instrumentos do mercado angolano, cotações disponíveis e datas das referências BODIVA.",
  path: "/mercado",
});
export default function MarketPage() {
  return (
    <PublicShell>
      <Consultation content="market" />
      <header className="page-heading">
        <p className="eyebrow">SEM LOGIN · CONSULTA PÚBLICA</p>
        <h1>Mercado.</h1>
        <p>
          Encontra um instrumento e consulta a última referência disponível.
        </p>
      </header>
      <Suspense fallback={<LoadingContent />}>
        <MarketContent />
      </Suspense>
      <AppInvitation feature="alerts" position="market-bottom" />
    </PublicShell>
  );
}
