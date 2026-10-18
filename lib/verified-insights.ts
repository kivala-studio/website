import Decimal from "decimal.js";
import { positions } from "./finance.ts";
import { kind, number, date } from "./market-presentation.ts";
import {
  wrapRows,
  type WrapEvidence,
  type WrapWindow,
} from "./wrap-evidence.ts";
import type { Security } from "./public-data";
import type { Transaction } from "./account-data";
import type { InsightCandidate } from "./insight-personalisation.ts";
export type VerifiedInsight = InsightCandidate & {
  title: string;
  value: string;
  body: string;
  details: { label: string; value: string }[];
  recordIDs: string[];
  period: WrapWindow;
  fetchedAt: number;
  source: string;
  personal: boolean;
  destination: string;
};
const movementLevel = (value: Decimal) =>
  value.abs().gte(5) ? 3 : value.abs().gte(3) ? 2 : value.abs().gte(1) ? 1 : 0;
const pct = (start: string, end: string) =>
  new Decimal(end).div(start).minus(1).times(100);
const signed = (value: Decimal) =>
  `${value.gt(0) ? "+" : ""}${number(value.toNumber())}`;
// Same closing-observation alias as iOS (IEEE-754 seconds bit pattern).
export function priceReceipt(asset: string, observedAt: string) {
  const buffer = new ArrayBuffer(8),
    view = new DataView(buffer);
  view.setFloat64(0, Date.parse(observedAt) / 1000, false);
  return `price:${new TextEncoder().encode(asset).length}:${asset}:${view.getBigUint64(0, false)}`;
}
export function verifiedInsights(input: {
  evidence: WrapEvidence;
  period: WrapWindow;
  securities: Security[];
  transactions: Transaction[];
  watchedIDs: string[];
  now: number;
  metadataFetchedAt: number;
  ledgerFetchedAt: number;
}) {
  const { evidence, period, securities, transactions, now } = input;
  const rows = wrapRows(evidence, period, securities, now, "insight");
  if (!rows) throw new Error("Unverified evidence");
  const ids = [...new Set(input.watchedIDs)].sort(),
    output: VerifiedInsight[] = [];
  const fresh = (time: number) =>
    Number.isFinite(time) && time <= now && now - time < 900000;
  if (
    !fresh(input.metadataFetchedAt) ||
    new Set(securities.map((s) => s.id)).size !== securities.length
  )
    throw new Error("Unverified metadata");
  const expiry = Math.min(
    Date.parse(evidence.calendar_snapshot.valid_until),
    Date.parse(evidence.fetched_at) + 900000,
    input.metadataFetchedAt + 900000,
  );
  const make = (
    family: string,
    assets: string[],
    title: string,
    value: string,
    body: string,
    series: typeof rows,
    significance: number,
    details: VerifiedInsight["details"] = [],
    relationshipAssets = assets,
  ) => {
    const isPortfolio = family.startsWith("portfolio"),
      id = `${family}:${period.starts_on}:${period.ends_on}:${[...relationshipAssets].sort().join(",")}`;
    const observations = series.flatMap((r) => r.series),
      last = Math.max(...observations.map((o) => Date.parse(o.observed_at)));
    const factKeys = isPortfolio
      ? [
          `portfolio:${family}:${Date.parse(`${evidence.baseline_day}T00:00:00+01:00`) / 1000}:${(Date.parse(`${period.ends_on}T00:00:00+01:00`) + 86400000) / 1000}`,
        ]
      : assets.flatMap((asset) => {
          const last = rows.find((r) => r.security.id === asset)?.series.at(-1);
          return last ? [priceReceipt(asset, last.observed_at)] : [];
        });
    output.push({
      id,
      factKeys: factKeys.length ? factKeys : [id],
      topics: assets.map(
        (id) => `price:${id}:${period.starts_on}:${period.ends_on}`,
      ),
      assets,
      relationshipAssets,
      family,
      category: isPortfolio
        ? "portfolio"
        : family === "assetPriceChange"
          ? "market"
          : "watchlist",
      observedAt: last,
      expiresAt: isPortfolio
        ? Math.min(expiry, input.ledgerFetchedAt + 900000)
        : expiry,
      significance,
      mandatory: false,
      title,
      value,
      body,
      details,
      recordIDs: [...new Set(observations.map((o) => o.record_id))],
      period,
      fetchedAt: Date.parse(evidence.fetched_at),
      source: evidence.calendar_snapshot.source,
      personal: true,
      destination: isPortfolio
        ? "/carteira"
        : assets.length === 1
          ? `/mercado/${assets[0]}`
          : "/lista",
    });
  };
  for (const row of rows) {
    const value = pct(row.series[0].price, row.series.at(-1)!.price);
    if (value.abs().gte(1))
      make(
        "assetPriceChange",
        [row.security.id],
        `${row.security.symbol} na semana`,
        `${signed(value)}%`,
        "Variação de preço entre o fecho de referência e o último fecho da semana. Não inclui dividendos, cupões ou encargos.",
        [row],
        movementLevel(value),
      );
  }
  const watched = ids.map((id) => rows.find((r) => r.security.id === id));
  if (ids.length && watched.every((r) => r)) {
    const complete = watched as typeof rows;
    const strongest = [...complete].sort(
      (a, b) =>
        Math.abs(b.change) - Math.abs(a.change) ||
        a.security.id.localeCompare(b.security.id),
    )[0];
    const value = pct(
      strongest.series[0].price,
      strongest.series.at(-1)!.price,
    );
    if (value.abs().gte(1))
      make(
        "watchlistMovement",
        [strongest.security.id],
        `${strongest.security.symbol} destacou-se na tua lista`,
        `${signed(value)}%`,
        "Maior variação absoluta de preço entre todos os instrumentos da tua lista nesta semana.",
        complete,
        movementLevel(value),
        [],
        ids,
      );
    if (ids.length >= 2 && complete.some((r) => Math.abs(r.change) >= 1))
      make(
        "watchlistBreadth",
        [],
        "A tua lista em perspectiva",
        `${complete.filter((r) => r.change > 0).length} subiram`,
        `${complete.filter((r) => r.change < 0).length} desceram e ${complete.filter((r) => r.change === 0).length} mantiveram o preço. Cobertura completa dos ${ids.length} instrumentos.`,
        complete,
        2,
        [],
        ids,
      );
  }
  for (const row of watched) {
    if (!row) continue;
    const series = row.series,
      last = series.at(-1)!,
      before = series.at(-2)!;
    const direction = new Decimal(last.price).comparedTo(before.price);
    let first = series.length - 1;
    while (
      direction &&
      first > 0 &&
      new Decimal(series[first].price).comparedTo(series[first - 1].price) ===
        direction
    )
      first--;
    const change = pct(series[first].price, last.price),
      sessions = series.length - 1 - first;
    if (sessions >= 3 && change.abs().gte(1))
      make(
        "watchlistSessionRun",
        [row.security.id],
        `${row.security.symbol}: ${sessions} sessões a ${direction > 0 ? "subir" : "descer"}`,
        `${signed(change)}%`,
        "Sequência de fechos consecutivos verificados. Uma sequência passada não prevê o próximo movimento.",
        [row],
        movementLevel(change),
        [
          {
            label: "Início da sequência",
            value: date(series[first].observed_at),
          },
        ],
      );
    const high = Decimal.max(...series.slice(0, -1).map((o) => o.price)),
      low = Decimal.min(...series.slice(0, -1).map((o) => o.price));
    const isHigh = new Decimal(last.price).gt(high),
      isLow = new Decimal(last.price).lt(low),
      gap = pct((isHigh ? high : low).toString(), last.price);
    if (series.length >= 5 && (isHigh || isLow) && gap.abs().gte(1))
      make(
        "watchlistClosingExtreme",
        [row.security.id],
        `${row.security.symbol}: novo ${isHigh ? "máximo" : "mínimo"} no período`,
        `${signed(gap)}%`,
        `${series.length} fechos comparáveis. Diferença face ao ${isHigh ? "máximo" : "mínimo"} anterior desta amostra; não é um recorde histórico.`,
        [row],
        movementLevel(gap),
      );
  }
  if (fresh(input.ledgerFetchedAt))
    try {
      positions(
        transactions,
        new Date(now + 3600000).toISOString().slice(0, 10),
      );
      if (transactions.some((t) => Date.parse(t.created_at) > now))
        throw new Error("Future ledger");
      const held = positions(
        transactions.filter((t) => t.traded_on <= period.ends_on),
        period.ends_on,
      ).filter((p) => p.quantity.gt(0));
      const covered = held.map((p) => ({
        position: p,
        row: rows.find((r) => r.security.id === p.securityID),
      }));
      if (
        held.length &&
        covered.every(
          (p) =>
            p.row &&
            p.row.security.currency === "AOA" &&
            ["Acções", "Fundos"].includes(kind(p.row.security)),
        )
      ) {
        if (
          transactions.some(
            (t) =>
              held.some((p) => p.securityID === t.security_id) &&
              kind(securities.find((s) => s.id === t.security_id)!) ===
                "Acções" &&
              !new Decimal(t.quantity).isInteger(),
          )
        )
          throw new Error("Fractional equity");
        const total = covered.reduce(
          (sum, p) =>
            sum.plus(p.position.quantity.times(p.row!.series.at(-1)!.price)),
          new Decimal(0),
        );
        if (!Number.isFinite(total.toNumber()) || total.lte(0))
          throw new Error("Unrepresentable portfolio");
        const ranked = covered
          .map((p) => ({
            ...p,
            value: p.position.quantity.times(p.row!.series.at(-1)!.price),
          }))
          .sort(
            (a, b) =>
              b.value.comparedTo(a.value) ||
              a.position.securityID.localeCompare(b.position.securityID),
          );
        const leading = ranked[0],
          weight = leading.value.div(total).times(100),
          assetIDs = held.map((p) => p.securityID),
          series = covered.map((p) => p.row!);
        const groups = (dimension: "issuer" | "sector") => {
          const values = new Map<string, { label: string; value: Decimal }>();
          for (const p of ranked) {
            const security = p.row!.security;
            const key =
              dimension === "issuer"
                ? security.issuer_id
                : security.issuers?.sector;
            const label =
              dimension === "issuer"
                ? security.issuers?.name
                : security.issuers?.sector;
            if (!key?.trim() || !label?.trim()) return [];
            const existing = values.get(key);
            if (existing && existing.label !== label) return [];
            values.set(key, {
              label,
              value: (existing?.value || new Decimal(0)).plus(p.value),
            });
          }
          return [...values.values()]
            .sort(
              (a, b) =>
                b.value.comparedTo(a.value) || a.label.localeCompare(b.label),
            )
            .map((p) => ({
              label: `${dimension === "issuer" ? "Emitente" : "Sector"}: ${p.label}`,
              value: `${number(p.value.div(total).times(100).toNumber())}%`,
            }));
        };
        make(
          "portfolioAllocation",
          [leading.position.securityID],
          "O peso da tua maior posição",
          `${number(weight.toNumber())}% em ${leading.row!.security.symbol}`,
          `Distribuição no último fecho da semana, com todas as ${held.length} posições avaliadas. Esta percentagem descreve concentração; não é uma classificação de risco.`,
          series,
          weight.gte(50) ? 2 : 0,
          [
            ...ranked.map((p) => ({
              label: p.row!.security.symbol,
              value: `${number(p.value.div(total).times(100).toNumber())}% · ${number(p.value.toNumber())} Kz`,
            })),
            ...groups("issuer"),
            ...groups("sector"),
          ],
          assetIDs,
        );
        if (
          !transactions.some(
            (t) =>
              t.traded_on > evidence.baseline_day! &&
              t.traded_on <= period.ends_on,
          )
        ) {
          const opening = covered.reduce(
              (sum, p) =>
                sum.plus(p.position.quantity.times(p.row!.series[0].price)),
              new Decimal(0),
            ),
            change = total.minus(opening),
            percentage = change.div(opening).times(100);
          const contributions = covered
            .map((p) => ({
              assetID: p.position.securityID,
              label: p.row!.security.symbol,
              value: p.position.quantity.times(
                new Decimal(p.row!.series.at(-1)!.price).minus(
                  p.row!.series[0].price,
                ),
              ),
            }))
            .sort(
              (a, b) =>
                b.value.comparedTo(a.value) ||
                a.assetID.localeCompare(b.assetID),
            );
          make(
            "portfolioPricePerformance",
            [contributions[0].assetID],
            "A tua carteira na semana",
            `${signed(percentage)}%`,
            `${signed(change)} Kz de variação de preço em posições sem operações no intervalo. Não inclui dividendos, comissões ou impostos.`,
            series,
            movementLevel(percentage),
            contributions.map((p) => ({
              label: p.label,
              value: `${signed(p.value)} Kz`,
            })),
            assetIDs,
          );
        }
      }
    } catch {
      /* Invalid or incomplete portfolios cannot produce partial financial observations. */
    }
  return output;
}
