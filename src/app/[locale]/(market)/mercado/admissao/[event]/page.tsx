import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { requestTime } from "@/data/clock";
import { readListingEvent } from "@/data/market/listing";
import { issuerLogoURL } from "@/data/market/logos";
import { getPublicIssuer } from "@/data/market/public-cache";
import { resolvedLogoURL } from "@/domain/market";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { Link, redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/ui/cn";
import { Card, READING_COLUMN } from "@/ui/components/layout";
import { SecurityLogo } from "@/ui/components/rows";
import { Icon } from "@/ui/icons/icon";

type Props = { params: Promise<{ locale: string; event: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { event: id } = await params;
  const event = await readListingEvent(id, requestTime());
  return event ? { title: event.title, robots: { index: false } } : {};
}

/**
 * A new admission announced in `market_events` before its security trades (iOS `AssetListingContent`). Once
 * the admission is confirmed and the security is in the catalogue, the instrument page replaces it.
 */
export default async function ListingPage({ params }: Props) {
  const { locale, event: id } = await params;
  const now = requestTime();
  const event = await readListingEvent(id, now);
  if (!event) notFound();
  const confirmed = event.status === "confirmed";
  if (confirmed && event.securityID) {
    const listed = (await catalogueRows(now))?.find((row) => row.id === event.securityID);
    if (listed) redirect({ href: `/mercado/${encodeURIComponent(listed.symbol)}`, locale: locale as AppLocale });
  }
  const t = await getTranslations();
  const issuer = event.issuerID ? await getPublicIssuer(event.issuerID).catch(() => undefined) : undefined;
  const name = issuer?.name ?? event.title;
  // `d MMMM` large, the year below it (a civil date: formatted in UTC so it never shifts a day).
  const day = event.scheduledDate
    ? new Intl.DateTimeFormat(locale === "pt" ? "pt-AO" : "en", { day: "numeric", month: "long", timeZone: "UTC" }).format(Date.parse(`${event.scheduledDate}T00:00:00Z`))
    : undefined;
  const year = event.scheduledDate?.slice(0, 4);

  return (
    <article className={cn(READING_COLUMN, "gap-6")} data-testid="listing">
      <Link href="/mercado" prefetch={false} className="-mb-2 -ml-1 inline-flex min-h-11 items-center gap-1 self-start rounded-small px-1 text-secondary font-semibold text-accent">
        <Icon name="chevron-left" />
        {t("common.market")}
      </Link>
      <header className="flex items-center gap-4">
        <SecurityLogo symbol={issuer?.shortName ?? name} logoUrl={issuer && resolvedLogoURL(issuer) ? issuerLogoURL(issuer.id) : undefined} size="l" />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-display text-primary-text">{name}</h1>
          <p className="text-secondary font-semibold text-accent">{t("assetDetails.listing.newAdmission")}</p>
        </div>
      </header>

      <Card
        title={
          <span className="flex items-center gap-2">
            <Icon name="calendar" className="text-secondary-text" />
            {t(confirmed ? "assetDetails.listing.admissionConfirmed" : "assetDetails.listing.admissionExpected")}
          </span>
        }
        titleId="listing-admission"
        bodyClassName="flex flex-col gap-4"
      >
        {day ? (
          <p className="flex flex-col">
            <span className="font-display text-headline text-primary-text">{day}</span>
            <span className="text-secondary text-secondary-text">{year}</span>
          </p>
        ) : null}
        <div className="flex flex-col gap-1 border-t border-hairline pt-4">
          <p className="text-body font-semibold text-primary-text">{t(confirmed ? "assetDetails.listing.statusConfirmed" : "assetDetails.listing.statusPending")}</p>
          <p className="text-secondary text-secondary-text">{t(confirmed ? "assetDetails.listing.confirmedMessage" : "assetDetails.listing.pendingMessage")}</p>
        </div>
      </Card>

      {issuer?.description ? (
        <Card title={t("assetDetails.listing.aboutHeader")} titleId="listing-about">
          <p className="text-body text-secondary-text">{issuer.description}</p>
        </Card>
      ) : null}

      <Card title={t("assetDetails.listing.quotesTitle")} titleId="listing-quotes">
        <p className="text-secondary text-secondary-text">{t("assetDetails.listing.quotesMessage")}</p>
      </Card>

      {event.sources.length > 0 ? (
        <Card title={t("assetDetails.listing.officialHeader")} titleId="listing-sources" flush className="overflow-hidden">
          <ul className="flex flex-col pb-2">
            {event.sources.map((source) => (
              <li key={source.url} className="border-t border-hairline first:border-t-0">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("assetDetails.accessibility.viewOfficialInfo", { arg1: source.name })}
                  className="flex min-h-14 items-center justify-between gap-3 px-5 py-2 motion-tap hover:bg-app-background/70 desk:px-6"
                >
                  <span className="flex flex-col">
                    <span className="text-body font-semibold text-primary-text">{source.name}</span>
                    <span className="text-caption text-secondary-text">{new URL(source.url).hostname.replace(/^www\./, "")}</span>
                  </span>
                  <Icon name="arrow-up-right" className="text-accent" />
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </article>
  );
}
