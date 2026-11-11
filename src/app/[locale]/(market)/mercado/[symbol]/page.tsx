import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { serverEnv } from "@/config/server-env";
import { encodePoints } from "@/data/market/history-wire";
import { getPublicDailyHistory, getPublicDividend, getPublicIssuer, getPublicReports } from "@/data/market/public-cache";
import { isBondKind } from "@/domain/market";
import { civilDate } from "@/domain/market/zone";
import { AboutPanel, BondFacts, type IssuerData } from "@/features/market/instrument/instrument-sections";
import { type InstrumentData, InstrumentView } from "@/features/market/instrument/instrument-view";
import { findInstrument } from "@/features/market/instrument/load";
import { pageMetadata } from "@/features/site/metadata";
import { JsonLd } from "@/features/site/structured-data";
import { getPathname, redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/ui/icons/icon";

type Props = { params: Promise<{ locale: string; symbol: string }> };

const settle = <T,>(promise: Promise<T>): Promise<T | null> => promise.catch(() => null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, symbol } = await params;
  const lookup = await findInstrument(symbol);
  if (lookup.kind !== "found") return {};
  const { instrument } = lookup;
  const t = await getTranslations({ locale: locale as AppLocale });
  const title = instrument.name !== instrument.symbol ? `${instrument.symbol} · ${instrument.name}` : instrument.symbol;
  return pageMetadata({
    locale: locale as AppLocale,
    path: `/mercado/${encodeURIComponent(instrument.symbol)}`,
    title,
    description: t("site.meta.instrumentDescription", { arg1: instrument.symbol }),
    image: "market",
  });
}

/**
 * Public instrument page: identity, the dated verified close, one year of daily closes, issuer
 * information and bond facts, rendered on the server. The current quote, status and session statistics
 * are added in the browser by the market store. One URL for everyone: signed-in panels join in W7.
 */
export default async function InstrumentPage({ params }: Props) {
  const { locale, symbol } = await params;
  const lookup = await findInstrument(symbol);
  if (lookup.kind === "redirect") redirect({ href: `/mercado/${encodeURIComponent(lookup.symbol)}`, locale: locale as AppLocale });
  if (lookup.kind !== "found") notFound();
  const { instrument } = lookup;
  const t = await getTranslations();

  const issuerID = instrument.issuerID;
  const [history, issuer, dividend, reports] = await Promise.all([
    settle(getPublicDailyHistory(instrument.id)),
    issuerID ? settle(getPublicIssuer(issuerID)) : Promise.resolve(undefined),
    issuerID ? settle(getPublicDividend(issuerID)) : Promise.resolve(undefined),
    issuerID ? settle(getPublicReports(issuerID)) : Promise.resolve([]),
  ]);
  const issuerName = issuer?.name ?? instrument.name;
  const bond = isBondKind(instrument.kind);
  const close = instrument.closingPrice;
  const data: InstrumentData = {
    id: instrument.id,
    symbol: instrument.symbol,
    name: instrument.name !== instrument.symbol ? instrument.name : undefined,
    kind: instrument.kind,
    bond,
    currency: instrument.currency ?? "AOA",
    isin: instrument.isin,
    issuerName: issuer?.name,
    logoURL: issuer?.logoURL,
    close: close && {
      price: close.price.toString(),
      date: civilDate(close.tradingDate),
      confirmedAt: close.confirmedAt,
      change: close.percentageChange?.toString(),
    },
  };
  const issuerData: IssuerData = { issuer, dividend, reports };
  const url = `${serverEnv.siteUrl}${getPathname({ locale: locale as AppLocale, href: `/mercado/${encodeURIComponent(instrument.symbol)}` })}`;

  return (
    <article className="flex flex-col gap-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "FinancialProduct",
              "@id": `${url}#instrument`,
              name: instrument.name,
              alternateName: instrument.symbol,
              url,
              ...(instrument.isin ? { identifier: { "@type": "PropertyValue", propertyID: "ISIN", value: instrument.isin } } : {}),
              category: t(`common.${bond ? "bonds" : instrument.kind === "fund" ? "funds" : "stocks"}`),
              provider: { "@type": "Organization", name: issuerName },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: t("common.market"), item: `${serverEnv.siteUrl}${getPathname({ locale: locale as AppLocale, href: "/mercado" })}` },
                { "@type": "ListItem", position: 2, name: instrument.symbol, item: url },
              ],
            },
          ],
        }}
      />
      <Link
        href="/mercado"
        prefetch={false}
        className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-small px-2 text-secondary font-semibold text-accent"
      >
        <Icon name="chevron-left" />
        {t("common.market")}
      </Link>
      <InstrumentView
        instrument={data}
        history={history ? encodePoints(history) : null}
        overview={bond ? <BondFacts instrument={instrument} issuerName={issuerName} /> : null}
        about={<AboutPanel instrument={instrument} issuerName={issuerName} data={issuerData} />}
      />
    </article>
  );
}
