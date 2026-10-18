import {
  wrapRows,
  type WrapWindow,
  type WrapEvidence,
} from "../../lib/wrap-evidence.ts";
import type { Security } from "../../lib/public-data";
import type { Transaction, Watch } from "../../lib/account-data";
import type { WrapEdition, WrapSource } from "../../lib/wrap-archive.ts";
import { canonical } from "../../lib/wrap-archive.ts";
import { composeWrapStories } from "./content.ts";

const watchesFor = (ids: string[]): Watch[] =>
  ids.map((security_id, sort_order) => ({
    security_id,
    sort_order,
    automatic_alerts_enabled: true,
    created_at: "",
  }));
export function createEdition(
  period: WrapWindow,
  evidence: WrapEvidence,
  securities: Security[],
  transactions: Transaction[],
  watches: Watch[],
  now: number,
): WrapEdition {
  const rows = wrapRows(evidence, period, securities, now);
  if (!rows?.length || !evidence.baseline_day)
    throw new Error("No complete evidence");
  const captured = transactions.filter((t) => t.traded_on <= period.ends_on);
  const watchedIDs = [...new Set(watches.map((w) => w.security_id))].sort();
  const content = composeWrapStories({
    rows,
    period,
    baseline: evidence.baseline_day,
    transactions: captured,
    watches: watchesFor(watchedIDs),
  });
  return {
    id: crypto.randomUUID(),
    edition: 1,
    compositionVersion: 1,
    createdAt: now,
    period,
    source: { evidence, securities, capturedAt: now },
    transactions: captured,
    watchedIDs,
    ...content,
  };
}
export function hydrateEdition(edition: WrapEdition, asOf = Infinity) {
  if (
    edition.createdAt > asOf ||
    edition.source.capturedAt > edition.createdAt ||
    (edition.watchSource && edition.watchSource.capturedAt > edition.createdAt)
  )
    throw new Error("Invalid capture time");
  const rows = wrapRows(
    edition.source.evidence,
    edition.period,
    edition.source.securities,
    edition.source.capturedAt,
    edition.correction ? "historical-repair" : "release",
  );
  const extra = edition.watchSource;
  const watchRows = extra
    ? wrapRows(
        extra.evidence,
        edition.period,
        extra.securities,
        extra.capturedAt,
        "historical-repair",
      )
    : rows;
  if (!rows?.length || !watchRows || !edition.source.evidence.baseline_day)
    throw new Error("Saved evidence cannot be verified");
  const content = composeWrapStories({
    rows,
    period: edition.period,
    baseline: edition.source.evidence.baseline_day,
    transactions: edition.transactions,
    watches: watchesFor(edition.watchedIDs),
    watchRows,
  });
  if (
    canonical(content.stories) !== canonical(edition.stories) ||
    content.portfolioOmission !== edition.portfolioOmission
  )
    throw new Error("Saved content does not match its evidence");
  return rows;
}
export function personalizationEdition(
  original: WrapEdition,
  watchedIDs: string[],
  source: WrapSource,
  now: number,
): WrapEdition {
  const rows = hydrateEdition(original);
  const watchRows = wrapRows(
    source.evidence,
    original.period,
    source.securities,
    now,
    "historical-repair",
  );
  const ids = [...new Set(watchedIDs)].sort();
  if (
    !watchRows ||
    ids.some((id) => !watchRows.some((row) => row.security.id === id)) ||
    source.evidence.baseline_day !== original.source.evidence.baseline_day
  )
    throw new Error("Incomplete watchlist evidence");
  const content = composeWrapStories({
    rows,
    period: original.period,
    baseline: original.source.evidence.baseline_day!,
    transactions: original.transactions,
    watches: watchesFor(ids),
    watchRows,
  });
  return {
    ...original,
    id: crypto.randomUUID(),
    edition: original.edition + 1,
    createdAt: now,
    watchedIDs: ids,
    watchSource: source,
    repair: { supersedes: original.id, capturedAt: now },
    correction: undefined,
    ...content,
  };
}
