import "server-only";
import { todayLuanda } from "./finance";
import { read } from "./public-data";
export type HistoryPoint = {
  trading_date: string;
  close_price: number;
  open_price?: number | null;
  high_price?: number | null;
  low_price?: number | null;
  volume?: number | null;
};
export async function history(securityID: string): Promise<HistoryPoint[]> {
  const rows: HistoryPoint[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: HistoryPoint[] = await read<HistoryPoint[]>("price_history", {
      select: "trading_date,close_price,open_price,high_price,low_price,volume",
      security_id: `eq.${securityID}`,
      order: "trading_date",
      limit: "1000",
      ...(cursor ? { trading_date: `gt.${cursor}` } : {}),
    });
    if (
      page.some(
        (p) =>
          !Number.isFinite(p.close_price) ||
          p.close_price <= 0 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(p.trading_date) ||
          new Date(p.trading_date).toISOString().slice(0, 10) !==
            p.trading_date ||
          p.trading_date > todayLuanda(),
      )
    )
      throw new Error("Invalid historical data");
    if (page.length && page.at(-1)!.trading_date === cursor)
      throw new Error("Invalid history cursor");
    rows.push(...page);
    if (page.length < 1000) return rows;
    cursor = page.at(-1)!.trading_date;
  }
}
