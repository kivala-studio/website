import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { requestTime } from "@/data/clock";
import { getPublicCatalogue } from "@/data/market/public-cache";
import { fetchSharedPortfolio, isShareToken } from "@/data/portfolio/shared-portfolio";
import { isBondKind } from "@/domain/market";
import { ErrorPresenter } from "@/features/errors/error-presenter";
import { MarketProvider } from "@/features/market/market-provider";
import { type SharedInstrument, SharedPortfolioView } from "@/features/portfolio/shared-portfolio-view";
import { pageMetadata } from "@/features/site/metadata";
import { ReadingPage } from "@/features/site/pages";
import { AreaMessages } from "@/i18n/area-messages";
import type { AppLocale } from "@/i18n/routing";
import { ToastHost } from "@/ui/components/feedback";
import { ErrorState } from "@/ui/components/states";

type Props = { params: Promise<{ locale: string; token: string }> };

/*
 * The token in the path is a bearer secret. It never reaches metadata, a canonical URL, the sitemap,
 * a client prop, a cache key or a log line: it is validated here and sent only in the server's
 * `no-store` POST body. next.config.ts adds `Referrer-Policy: no-referrer` and `Cache-Control: no-store`.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale });
  return {
    ...pageMetadata({
      locale: locale as AppLocale,
      path: "/",
      title: t("site.meta.shareTitle"),
      description: t("site.meta.homeDescription"),
      image: "home",
      indexable: false,
    }),
    referrer: "no-referrer",
  };
}

export default async function SharedPortfolioPage({ params }: Props) {
  const { token } = await params;
  if (!isShareToken(token)) notFound();
  const t = await getTranslations();

  let shared: Awaited<ReturnType<typeof fetchSharedPortfolio>>;
  try {
    shared = await fetchSharedPortfolio(token);
  } catch {
    return (
      <ReadingPage title={t("site.meta.shareTitle")}>
        <ErrorState message={t("components.placeholder.loadFailed")} />
      </ReadingPage>
    );
  }
  if (!shared) notFound();

  const held = new Set(shared.transactions.map((row) => row.securityId));
  const instruments: SharedInstrument[] = (await getPublicCatalogue())
    .filter((instrument) => held.has(instrument.id))
    .map((instrument) => ({
      id: instrument.id,
      symbol: instrument.symbol,
      name: instrument.name,
      securityType: instrument.securityType,
      bond: isBondKind(instrument.kind),
      currency: instrument.currency ?? "AOA",
    }));

  return (
    <ReadingPage title={shared.name ?? t("site.meta.shareTitle")}>
      <AreaMessages area="share">
        <ToastHost>
          <MarketProvider>
            <ErrorPresenter />
            <SharedPortfolioView transactions={shared.transactions} instruments={instruments} asOf={requestTime()} />
          </MarketProvider>
        </ToastHost>
      </AreaMessages>
    </ReadingPage>
  );
}
