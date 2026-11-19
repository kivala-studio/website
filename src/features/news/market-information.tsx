"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  MARKET_UPDATE_CATEGORIES,
  type MarketUpdate,
  type MarketUpdateCategory,
  displayPrice,
  displayPriceChange,
  isBondKind,
  marketUpdates,
  relatedSecurities,
} from "@/domain/market";
import { useMarketState, useMarketStore } from "@/features/market/market-provider";
import { Link } from "@/i18n/navigation";
import { cn } from "@/ui/cn";
import { Button } from "@/ui/components/buttons";
import { FilterTabs } from "@/ui/components/controls";
import { Card, Panel } from "@/ui/components/layout";
import { SeeAll } from "@/ui/components/see-all";
import { AssetRow } from "@/ui/components/rows";
import { EmptyState, ErrorState, InstrumentRowSkeleton, Skeleton } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon, type IconName } from "@/ui/icons/icon";

/*
 * Market information (iOS `MarketInformationView`, `MarketUpdateDetailView`, `MarketUpdatesSection`): short
 * BODIVA, issuer and market notices carried by the market snapshot. No live source sends any yet, so the entry
 * points stay hidden until one does; the demo scenario `updates` fills them.
 */

const ICONS: Record<MarketUpdateCategory, IconName> = { bodiva: "markets", issuers: "portfolio", market: "trend-up", notices: "document" };
const CATEGORY_KEYS: Record<MarketUpdateCategory, string | null> = {
  bodiva: null,
  issuers: "market.snapshot.issuers",
  market: "common.market",
  notices: "market.snapshot.announcements",
};
const HOME_LIMIT = 3;
export const updateHref = (update: MarketUpdate) => `/mercado/informacao/${encodeURIComponent(update.id)}`;

function useCategoryTitle() {
  const t = useTranslations();
  return (category: MarketUpdateCategory) => {
    const key = CATEGORY_KEYS[category];
    return key ? t(key as never) : "BODIVA";
  };
}

/** The tab's snapshot updates, newest first; `undefined` until the market has loaded. */
function useUpdates() {
  const state = useMarketState();
  const snapshot = state.load.kind === "loaded" ? state.load.snapshot : undefined;
  const updates = useMemo(() => (snapshot ? marketUpdates(snapshot.updates ?? []) : undefined), [snapshot]);
  return { state, snapshot, updates };
}

function IconTile({ category, large = false }: { category: MarketUpdateCategory; large?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-accent/10 text-accent",
        large ? "min-h-30 w-full rounded-large" : "size-12 rounded-medium",
      )}
    >
      <Icon name={ICONS[category]} scale={large ? "l" : undefined} />
    </span>
  );
}

function UpdateRow({ update }: { update: MarketUpdate }) {
  const at = useMarketState().assessedAt;
  const t = useTranslations();
  const format = useFormat();
  const category = useCategoryTitle();
  return (
    <Link
      href={updateHref(update)}
      className="flex min-h-18 items-center gap-3 rounded-small py-3"
      aria-description={t("news.information.rowOpenHint")}
      data-testid="market-update-row"
    >
      <IconTile category={update.category} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-semibold text-accent">{category(update.category)}</span>
        <span className="text-secondary font-semibold text-primary-text">{update.title}</span>
        <span className="text-caption text-secondary-text">{update.detail}</span>
        <span className="text-caption text-tertiary-text">
          {update.source} · <time dateTime={new Date(update.timestamp).toISOString()}>{at === undefined ? format.time(update.timestamp) : format.relativeDay(update.timestamp, at)}</time>
        </span>
      </span>
      <Icon name="chevron-right" className="text-tertiary-text" />
    </Link>
  );
}

/** Home section 6, `Mercado`: the three newest updates, only when there are any. */
export function HomeMarketUpdates() {
  const t = useTranslations();
  const { updates } = useUpdates();
  if (!updates || updates.length === 0) return null;
  return (
    <Panel title={t("common.market")} titleId="home-market-updates" data-testid="home-market-updates" action={<SeeAll href="/mercado/informacao" />}>
      <ul className="flex flex-col divide-y divide-separator lg:divide-hairline">
        {updates.slice(0, HOME_LIMIT).map((update) => (
          <li key={update.id}>
            <UpdateRow update={update} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The Markets entry row (iOS `MarketInformationSummary`) above the market list, only when there are updates. */
export function MarketInformationSummary() {
  const t = useTranslations();
  const format = useFormat();
  const { updates } = useUpdates();
  if (!updates || updates.length === 0) return null;
  return (
    <Link
      href="/mercado/informacao"
      className="flex min-h-14 items-center gap-3 rounded-large px-4 py-3 panel motion-tap hover:bg-app-background/70 desk:px-6"
      data-testid="market-information-summary"
    >
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
        <Icon name="news" scale="s" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex shrink-0 items-center gap-2 font-display text-body font-semibold text-primary-text">
          {t("common.marketInformation")}
          <span className="rounded-full bg-accent-soft px-2 font-sans text-caption font-semibold text-accent">{format.count(updates.length)}</span>
        </span>
        <span className="line-clamp-2 text-secondary text-secondary-text sm:line-clamp-1">{updates[0].title}</span>
      </span>
      <Icon name="chevron-right" className="text-tertiary-text" />
    </Link>
  );
}

function Failed() {
  const t = useTranslations();
  const store = useMarketStore();
  return (
    <ErrorState
      title={t("errors.market.loadFailed")}
      message={t("common.checkConnectionMessage")}
      action={
        <Button kind="secondary" className="w-auto!" onClick={() => void store.load({ force: true })}>
          {t("common.tryAgain")}
        </Button>
      }
    />
  );
}

/** `/mercado/informacao`: category chips over the update rows. */
export function MarketInformationView() {
  const t = useTranslations();
  const category = useCategoryTitle();
  const { state, updates } = useUpdates();
  const [selected, setSelected] = useState<MarketUpdateCategory | "all">("all");
  const shown = useMemo(() => (updates ? marketUpdates(updates, selected === "all" ? undefined : selected) : undefined), [updates, selected]);
  const chips = [{ value: "all" as const, title: t("common.all") }, ...MARKET_UPDATE_CATEGORIES.map((value) => ({ value, title: category(value) }))];

  if (!shown) {
    return state.load.kind === "failed" ? (
      <div data-testid="market-information-error">
        <Failed />
      </div>
    ) : (
      <div className="flex flex-col gap-3" aria-busy data-testid="market-information-loading">
        <Skeleton className="h-11 w-full" />
        <InstrumentRowSkeleton />
        <InstrumentRowSkeleton />
      </div>
    );
  }
  return (
    <section className="flex flex-col gap-4" aria-labelledby="market-updates-heading" data-testid="market-information">
      <h2 id="market-updates-heading" className="sr-only">
        {t("common.marketInformation")}
      </h2>
      <FilterTabs options={chips} value={selected} onChange={setSelected} label={t("news.information.categoryLabel")} testID="market-information-chip" />
      {shown.length === 0 ? (
        <Card data-testid="market-information-empty">
          <EmptyState icon="document" title={t("news.information.emptyTitle")} message={t("news.information.emptyMessage")} />
        </Card>
      ) : (
        <Card className="py-1!">
          <ul className="flex flex-col divide-y divide-hairline">
            {shown.map((update) => (
              <li key={update.id}>
                <UpdateRow update={update} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

/** `/mercado/informacao/[id]`: one update, its body and the instruments it names. */
export function MarketUpdateDetail({ id }: { id: string }) {
  const t = useTranslations();
  const format = useFormat();
  const category = useCategoryTitle();
  const { state, snapshot, updates } = useUpdates();
  const at = state.assessedAt;
  if (!updates || !snapshot || at === undefined) {
    return state.load.kind === "failed" ? (
      <Failed />
    ) : (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-30 w-full" />
      </div>
    );
  }
  const update = updates.find((item) => item.id === id);
  if (!update) {
    return (
      <div data-testid="market-update-missing">
        <EmptyState icon="document" title={t("news.information.emptyTitle")} action={<BackLink />} />
      </div>
    );
  }
  const related = relatedSecurities(update, snapshot.securities, at);
  return (
    <article className="flex flex-col gap-6" data-testid="market-update-detail">
      <BackLink />
      <header className="flex flex-col gap-2">
        <span className="text-caption font-semibold text-accent">{category(update.category)}</span>
        <h1 className="text-display text-primary-text">{update.title}</h1>
        <p className="text-body text-secondary-text">{update.detail}</p>
        <p className="text-caption text-tertiary-text">
          {update.source} · <time dateTime={new Date(update.timestamp).toISOString()}>{format.timestamp(update.timestamp)}</time>
        </p>
      </header>
      <Card className="flex flex-col gap-6">
        <IconTile category={update.category} large />
        <div className="flex flex-col gap-4 text-body leading-relaxed text-primary-text">
          {update.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </Card>
      {related.length > 0 ? (
        <Card title={t("common.relatedSecurities")} titleId="market-update-related" bodyClassName="pt-0! pb-1!">
          <ul className="flex flex-col divide-y divide-hairline">
            {related.map((security) => {
              const bond = isBondKind(security.kind);
              return (
                <li key={security.id}>
                  <AssetRow
                    symbol={security.symbol}
                    name={security.name}
                    price={displayPrice(security, at) ?? null}
                    change={displayPriceChange(security, at)}
                    bond={bond}
                    code={security.currency}
                    logoUrl={security.logoURL}
                    brandColor={bond ? "violet" : "blue"}
                    href={`/mercado/${encodeURIComponent(security.symbol)}`}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </article>
  );
}

function BackLink() {
  const t = useTranslations();
  return (
    <Link href="/mercado/informacao" className="-mb-2 -ml-1 inline-flex min-h-11 items-center gap-1 self-start rounded-small px-1 text-secondary font-semibold text-accent">
      <Icon name="chevron-left" />
      {t("common.marketInformation")}
    </Link>
  );
}
