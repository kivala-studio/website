import { getLocale, getTranslations } from "next-intl/server";

import { requestTime } from "@/data/clock";
import { type AvailableWrap, readAvailableWraps, wrapSlug } from "@/data/account/wraps";
import { readListingEvents } from "@/data/market/listing";
import { getPublicNews } from "@/data/market/public-cache";
import { type FormatLocale, createFormat } from "@/domain/format";
import { homeListing } from "@/domain/market";
import { newsKindKey } from "@/domain/news/article";
import { HomeView } from "@/features/home/home-market";
import { Publications } from "@/features/news/publications";
import { catalogueRows } from "@/features/market/browse/catalogue";
import { SIGNED_IN_PAGE, signedInMetadata } from "@/features/shell/placeholder-page";
import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { OfflineBanner } from "@/ui/components/feedback";
import { Icon } from "@/ui/icons/icon";

export const generateMetadata = signedInMetadata("common.home");

const NEWS_LIMIT = 3;
const REVIEW_KEY = { weekly: "weeklyWrap.stage.reviewWeekly", monthly: "weeklyWrap.stage.reviewMonthly", yearly: "weeklyWrap.stage.reviewYearly" } as const;

/** Início (iOS `HomeView`): the market from the tab's store, the reading sections from the server. */
export default async function HomePage() {
  const t = await getTranslations();
  const format = createFormat((await getLocale()) as FormatLocale, (key, values) => t(key as never, values as never));
  const now = requestTime();
  const [rows, news, wraps, listings] = await Promise.all([
    catalogueRows(now),
    getPublicNews(0, NEWS_LIMIT).catch(() => null),
    readAvailableWraps(now),
    readListingEvents(now),
  ]);
  const listing = homeListing(listings, now);

  return (
    <main id="main" className={cn(SIGNED_IN_PAGE, "flex flex-col gap-4")}>
      <OfflineBanner />
      <HomeView
        rows={rows ?? []}
        context={
          listing ? (
            <Link
              href={`/mercado/admissao/${listing.id}`}
              className="flex min-h-18 items-center gap-4 rounded-large bg-elevated-background p-4"
              data-testid="home-listing"
            >
              <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-accent text-accent">
                <Icon name="calendar" scale="l" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-micro font-bold tracking-wide text-accent uppercase">{t("home.event.newAdmission")}</span>
                <span className="truncate text-body font-semibold text-primary-text">{listing.title}</span>
                <span className="text-caption text-secondary-text">
                  {listing.status === "confirmed" ? t("home.event.statusOnBodiva") : t("home.event.statusPending")}
                  {listing.scheduledDate ? ` · ${format.civilDate(listing.scheduledDate)}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-1 text-secondary font-semibold text-accent max-sm:sr-only">
                {t("home.event.meetCompany")}
                <Icon name="arrow-right" />
              </span>
            </Link>
          ) : null
        }
        news={<Publications articles={news?.articles ?? null} format={format} title={t("common.news")} unavailable={t("components.placeholder.loadFailed")} kind={(article) => t(newsKindKey(article))} />}
        recaps={wraps.length > 0 ? <Recaps wraps={wraps} title={t("home.contextCard.availableSummaries")} label={(wrap) => `${t(REVIEW_KEY[wrap.period])} · ${format.civilPeriod(wrap.startsOn, wrap.endsOn)}`} /> : null}
        simulator={
          <Link href="/simulador" className="flex min-h-18 items-center gap-4 rounded-small border-y border-separator py-3 lg:panel lg:min-h-14 lg:px-4" data-testid="home-simulator">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
              <Icon name="calculator" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body font-semibold text-primary-text">{t("common.simulateInvestment")}</span>
              <span className="text-caption text-secondary-text">{t("simulation.entry.prompt")}</span>
            </span>
            <Icon name="chevron-right" className="text-tertiary-text" />
          </Link>
        }
      />
    </main>
  );
}

function Recaps({ wraps, title, label }: { wraps: readonly AvailableWrap[]; title: string; label: (wrap: AvailableWrap) => string }) {
  return (
    <section aria-labelledby="home-recaps" className="flex flex-col gap-2 lg:panel lg:gap-0 lg:px-4 lg:py-3" data-testid="home-recaps">
      <h2 id="home-recaps" className="text-secondary font-semibold text-secondary-text">
        {title}
      </h2>
      <ul className="flex flex-col">
        {wraps.map((wrap) => (
          <li key={wrapSlug(wrap)}>
            <Link href={`/wrap/${wrapSlug(wrap)}`} className="flex min-h-11 items-center justify-between gap-3 rounded-small text-secondary text-accent">
              {label(wrap)}
              <Icon name="chevron-right" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
