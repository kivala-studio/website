import { useTranslations } from "next-intl";

import { isVisibleOutsideSearch, kindLabelKey, marketSecurity, securityDisplayName } from "@/domain/market";
import type { NewsArticle } from "@/domain/news/article";
import { type CatalogueRow, PriceCell } from "@/features/market/browse/price-cell";
import { Link } from "@/i18n/navigation";
import { SectionHeader } from "@/ui/components/layout";
import { SecurityLogo } from "@/ui/components/rows";

/** Visible instruments the article links to (by id or symbol), with their dated verified close. */
export function RelatedInstruments({ article, rows, now }: { article: NewsArticle; rows: readonly CatalogueRow[]; now: number }) {
  const t = useTranslations();
  const translate = (key: string) => t(key as never);
  const related = rows.filter(
    (row) =>
      isVisibleOutsideSearch(marketSecurity({ id: row.id, symbol: row.symbol, kind: row.kind }), now) &&
      article.securities.some((link) => link.id === row.id || link.symbol === row.symbol),
  );
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="related" className="flex flex-col gap-1">
      <SectionHeader id="related" title={t("common.relatedSecurities")} />
      <ul className="flex flex-col">
        {related.map((row) => (
          <li key={row.id} className="border-b border-separator last:border-b-0">
            <Link
              href={`/mercado/${encodeURIComponent(row.symbol)}`}
              prefetch={false}
              aria-description={t("common.openSecurityDetailsHint")}
              className="flex min-h-18 items-center gap-3 rounded-small py-2"
              data-testid="related-instrument"
            >
              <SecurityLogo symbol={row.symbol} brandColor={row.bond ? "violet" : "blue"} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-body font-semibold text-primary-text">{row.symbol}</span>
                <span className="truncate text-secondary text-secondary-text">
                  {securityDisplayName(marketSecurity({ id: row.id, symbol: row.symbol, kind: row.kind, name: row.name, issuer: row.issuer })) ?? translate(kindLabelKey(row.kind))}
                </span>
              </span>
              <PriceCell row={row} security={undefined} at={undefined} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
