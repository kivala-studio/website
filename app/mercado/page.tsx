import { Suspense } from "react";
import { PublicShell, FeatureInvitation } from "../public-shell";
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
        <h1>Mercado.</h1>
      </header>
      <Suspense fallback={<LoadingContent />}>
        <MarketContent />
      </Suspense>
      <FeatureInvitation feature="alerts" position="market-bottom" />
    </PublicShell>
  );
}
