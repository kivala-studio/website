import { DAY_MS, type EpochMs, civilDate, dayStart, weekday } from "@/domain/market/zone";

import { recordedSnapshot } from "./scenarios";

/*
 * Demo mode only (no backend): data the recorded snapshot does not contain, so public pages can be
 * exercised offline and in Playwright. Nothing here is ever served outside `NEXT_PUBLIC_DATA_MODE=demo`.
 *
 * Daily history is a deterministic walk that ends exactly on each instrument's recorded verified
 * close; instruments without a close have none. Articles are dated relative to the request.
 */

type Row = Record<string, unknown>;

/** Mulberry32: a tiny seeded generator, so every request sees the same demo series. */
function seeded(seed: string): () => number {
  let state = [...seed].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 2_654_435_761) >>> 0, 2_166_136_261);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const closes = new Map(recordedSnapshot.closes.map((row) => [row.security_id, row]));
const bonds = new Set(
  recordedSnapshot.securities.filter((row) => row.security_type === "bond" || row.security_type === "treasury_bond").map((row) => row.id),
);

/** `price_history` rows (M13 columns) for one security, at most `days` back from its last close. */
export function demoHistoryRows(securityID: string, days: number): Row[] {
  const close = closes.get(securityID);
  const end = close && dayStart(close.trading_date);
  if (!close || end === undefined) return [];
  const random = seeded(securityID);
  const bond = bonds.has(securityID);
  const volatility = bond ? 0.0025 : 0.012;
  const decimals = bond ? 2 : 0;
  const rows: Row[] = [];
  let value = Number(close.price);
  for (let day = end; day > end - days * DAY_MS; day -= DAY_MS) {
    const weekdayIndex = weekday(day);
    if (weekdayIndex === 1 || weekdayIndex === 7) continue;
    const rounded = Number(value.toFixed(decimals));
    rows.push({ security_id: securityID, trading_date: civilDate(day), close_price: rounded, open_price: null, high_price: null, low_price: null, volume: null });
    value = Math.max(value * (1 + (random() - 0.5) * 2 * volatility), bond ? 50 : 1000);
  }
  return rows.reverse();
}

const SECURITY = (symbol: string) => {
  const row = recordedSnapshot.securities.find((security) => security.symbol === symbol)!;
  return { securities: { id: row.id, symbol: row.symbol, name: row.name } };
};

const SOURCE = { source_url: "https://www.bodiva.ao/", source_title: null, is_primary: true, news_sources: { name: "BODIVA" } };

/** Published demo articles relative to `now`, newest first (the order the news select returns). */
export function demoNewsRows(now: EpochMs): Row[] {
  const at = (days: number, hours = 0) => new Date(now - days * DAY_MS - hours * 3_600_000).toISOString();
  const rows: Row[] = [
    {
      id: "d0000000-0000-4000-8000-000000000001",
      slug: "fecho-da-sessao",
      title: "Fecho da sessão na BODIVA",
      summary: "Resumo das cotações de fecho verificadas da última sessão.",
      body_markdown:
        "## Sessão\n\nAs cotações de **fecho verificadas** estão disponíveis para os títulos negociados.\n\n- Ações com negócios registados\n- Obrigações do Tesouro\n\n> Dados públicos das sessões oficiais da BODIVA.\n\nConsulta a [BODIVA](https://www.bodiva.ao/) ou [esta ligação](javascript:alert(1)).",
      published_at: at(0, 1),
      recap_period: null,
      market_recaps: { trading_date: civilDate(now - DAY_MS) },
      news_article_categories: [{ news_categories: { name: "Mercado" } }],
      news_article_sources: [SOURCE],
      news_article_securities: [SECURITY("BFAAAAAA"), SECURITY("BAIAAAAA")],
    },
    {
      id: "d0000000-0000-4000-8000-000000000002",
      slug: "admissao-de-titulos",
      title: "Novos títulos admitidos à negociação",
      summary: "A BODIVA publicou a admissão de novas obrigações do Tesouro.",
      body_markdown: "A admissão foi publicada no site da BODIVA.\n\n1. Consulta o comunicado\n2. Verifica a data de vencimento\n\n---\n\n*Fonte primária indicada abaixo.*",
      published_at: at(1, 2),
      recap_period: null,
      market_recaps: null,
      news_article_categories: [{ news_categories: { name: "Comunicados" } }],
      news_article_sources: [SOURCE],
      news_article_securities: [],
    },
    {
      id: "d0000000-0000-4000-8000-000000000003",
      slug: "recap-semanal",
      title: "Recap semanal do mercado",
      summary: "As sessões da semana em números verificados.",
      body_markdown: "## Semana\n\nCinco sessões com fechos verificados.",
      published_at: at(9),
      recap_period: "weekly",
      market_recaps: null,
      news_article_categories: [],
      news_article_sources: [SOURCE],
      news_article_securities: [SECURITY("ENSAAAAA")],
    },
  ];
  for (let index = 0; index < 22; index += 1) {
    rows.push({
      id: `d0000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`,
      slug: `arquivo-${index + 1}`,
      title: `Comunicado de mercado ${index + 1}`,
      summary: "Comunicado publicado pela BODIVA.",
      body_markdown: "Comunicado publicado pela BODIVA.",
      published_at: at(35 + index * 17),
      recap_period: null,
      market_recaps: null,
      news_article_categories: [],
      news_article_sources: [SOURCE],
      news_article_securities: [],
    });
  }
  return rows;
}
