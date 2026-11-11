import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { requestTime } from "@/data/clock";
import { readListingEvent } from "@/data/market/listing";
import { getPublicIssuer } from "@/data/market/public-cache";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { Link, redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { SectionHeader } from "@/ui/components/layout";
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
    <article className="flex flex-col gap-8" data-testid="listing">
      <Link href="/mercado" prefetch={false} className="inline-flex min-h-11 items-center gap-1 self-start rounded-small text-secondary text-accent">
        <Icon name="chevron-left" />
        {t("common.market")}
      </Link>
      <header className="flex flex-col items-center gap-3 text-center">
        <SecurityLogo symbol={issuer?.shortName ?? name} logoUrl={issuer?.logoURL} size="l" />
        <h1 className="text-display text-primary-text">{name}</h1>
        <p className="text-secondary font-semibold text-accent">{t("assetDetails.listing.newAdmission")}</p>
      </header>

      <section aria-labelledby="listing-admission" className="flex flex-col gap-4 rounded-large bg-elevated-background p-5">
        <h2 id="listing-admission" className="flex items-center gap-2 text-secondary font-semibold text-secondary-text">
          <Icon name="calendar" />
          {t(confirmed ? "assetDetails.listing.admissionConfirmed" : "assetDetails.listing.admissionExpected")}
        </h2>
        {day ? (
          <p className="flex flex-col">
            <span className="text-headline text-primary-text">{day}</span>
            <span className="text-secondary text-secondary-text">{year}</span>
          </p>
        ) : null}
        <div className="flex flex-col gap-1 border-t border-separator pt-4">
          <p className="text-body font-semibold text-primary-text">{t(confirmed ? "assetDetails.listing.statusConfirmed" : "assetDetails.listing.statusPending")}</p>
          <p className="text-secondary text-secondary-text">{t(confirmed ? "assetDetails.listing.confirmedMessage" : "assetDetails.listing.pendingMessage")}</p>
        </div>
      </section>

      {issuer?.description ? (
        <section aria-labelledby="listing-about" className="flex flex-col gap-2">
          <SectionHeader id="listing-about" title={t("assetDetails.listing.aboutHeader")} />
          <p className="text-body text-secondary-text">{issuer.description}</p>
        </section>
      ) : null}

      <section aria-labelledby="listing-quotes" className="flex flex-col gap-2">
        <SectionHeader id="listing-quotes" title={t("assetDetails.listing.quotesTitle")} />
        <p className="text-secondary text-secondary-text">{t("assetDetails.listing.quotesMessage")}</p>
      </section>

      {event.sources.length > 0 ? (
        <section aria-labelledby="listing-sources" className="flex flex-col gap-2">
          <SectionHeader id="listing-sources" title={t("assetDetails.listing.officialHeader")} />
          <ul className="flex flex-col">
            {event.sources.map((source) => (
              <li key={source.url} className="border-b border-separator last:border-b-0">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("assetDetails.accessibility.viewOfficialInfo", { arg1: source.name })}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-small py-2"
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
        </section>
      ) : null}
    </article>
  );
}
