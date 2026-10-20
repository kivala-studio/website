import Decimal from "decimal.js";
import { positions } from "../../lib/finance.ts";
import { date, kind, number } from "../../lib/market-presentation.ts";
import type { wrapRows, WrapWindow } from "../../lib/wrap-evidence.ts";
import type { Transaction, Watch } from "../../lib/account-data";
export type Row = NonNullable<ReturnType<typeof wrapRows>>[number];
export type Story = {
  id: string;
  title: string;
  value: string;
  body: string;
  personal?: boolean;
  color?: string;
};
export function composeWrapStories({
  rows,
  period,
  baseline,
  transactions,
  watches,
  watchRows = rows,
}: {
  rows: Row[];
  period: WrapWindow;
  baseline: string;
  transactions: Transaction[];
  watches: Watch[];
  watchRows?: Row[];
}) {
  const equities = rows.filter((r) => kind(r.security) === "Acções");
  const stories: Story[] = [
    {
      id: "opening",
      title:
        period.period_type === "weekly"
          ? "A tua semana no mercado."
          : "O teu período no mercado.",
      value: `${date(period.starts_on)} — ${date(period.ends_on)}`,
      body: "Os movimentos, a tua lista e os teus investimentos. A partir de fechos verificados.",
    },
  ];
  let portfolioOmission = "";
  {
    const watched = watchRows.filter((r) =>
      watches.some((w) => w.security_id === r.security.id),
    );
    if (watched.length)
      stories.push({
        id: "watchlist",
        title: "Na tua lista",
        value: `${watched.filter((r) => r.change > 0).length} subiram · ${watched.filter((r) => r.change < 0).length} desceram`,
        body: `${watched.length} de ${watches.length} instrumentos com fechos comparáveis. ${watched.filter((r) => r.change === 0).length} sem alteração.`,
        personal: true,
      });
    if (transactions.length) {
      if (
        transactions.some(
          (t) => t.traded_on > baseline && t.traded_on <= period.ends_on,
        )
      )
        portfolioOmission =
          "A carteira tem operações no período. O resumo de desempenho foi omitido para não confundir reforços ou vendas com ganhos.";
      else {
        try {
          const held = positions(
            transactions.filter((t) => t.traded_on <= baseline),
          ).filter((p) => p.quantity.gt(0));
          const covered = held.map((p) => ({
            position: p,
            row: rows.find(
              (r) =>
                r.security.id === p.securityID &&
                r.security.currency === "AOA" &&
                ["Acções", "Fundos"].includes(kind(r.security)),
            ),
          }));
          if (held.length && covered.every((p) => p.row)) {
            const initial = covered.reduce(
              (sum, p) => sum.plus(p.position.quantity.times(p.row!.start)),
              new Decimal(0),
            );
            const change = covered.reduce(
              (sum, p) =>
                sum.plus(
                  p.position.quantity.times(
                    new Decimal(p.row!.end).minus(p.row!.start),
                  ),
                ),
              new Decimal(0),
            );
            stories.push({
              id: "portfolio",
              title: "A tua carteira no período",
              value: `${change.gt(0) ? "+" : ""}${number(change.toNumber())} Kz`,
              body: `${number(change.div(initial).times(100).toNumber())}% de variação de preço nas posições sem operações no período. Não inclui dividendos, comissões ou impostos.`,
              personal: true,
              color: change.gte(0) ? "#35c98b" : "#ff6677",
            });
          } else if (held.length)
            portfolioOmission =
              "Faltam fechos verificados para apresentar um resumo completo da carteira.";
        } catch {
          portfolioOmission =
            "Os registos da carteira precisam de revisão antes de calcular o resumo.";
        }
      }
    }
  }
  if (equities.length) {
    stories.push({
      id: "market-breadth",
      title: "As acções em perspectiva",
      value: `${equities.filter((r) => r.change > 0).length} subiram`,
      body: `${equities.filter((r) => r.change < 0).length} desceram e ${equities.filter((r) => r.change === 0).length} mantiveram o preço. Cobertura: ${equities.length} acções com fechos comparáveis.`,
    });
    const rising = equities.find((r) => r.change > 0),
      falling = [...equities].reverse().find((r) => r.change < 0);
    for (const row of [rising, falling])
      if (row)
        stories.push({
          id: `market-${row.security.id}`,
          title: row.security.issuers?.name || row.security.symbol,
          value: `${row.change > 0 ? "+" : ""}${number(row.change)}%`,
          body: `${row.change > 0 ? "Maior subida" : "Maior descida"} de preço entre as acções com fechos comparáveis. ${row.security.symbol} · base em ${date(baseline)}.`,
          color: row.change > 0 ? "#35c98b" : "#ff6677",
        });
  }
  stories.push({
    id: "closing",
    title: "O próximo passo é teu.",
    value: "Continua a acompanhar.",
    body: "Consulta os dados e as fontes abaixo. As variações de preço não incluem dividendos, cupões ou encargos.",
  });
  return { stories, portfolioOmission };
}
