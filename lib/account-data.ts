import type { SupabaseClient } from "@supabase/supabase-js";
export type Watch = {
  security_id: string;
  sort_order: number;
  automatic_alerts_enabled: boolean;
  created_at: string;
};
export type Rule = {
  id: string;
  security_id: string;
  kind: "price_above" | "price_below" | "percent_change_above";
  threshold: number;
  is_enabled: boolean;
  created_at: string;
};
export type Transaction = {
  id: string;
  security_id: string;
  transaction_kind: "buy" | "sell";
  quantity: number | string;
  unit_price: number | string;
  traded_on: string;
  created_at: string;
};
export async function watchlist(
  client: SupabaseClient,
  userID: string,
): Promise<Watch[]> {
  const rows: Watch[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from("watchlist_items")
      .select("security_id,sort_order,automatic_alerts_enabled,created_at")
      .eq("user_id", userID)
      .order("sort_order")
      .order("security_id")
      .range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function ledger(client: SupabaseClient): Promise<Transaction[]> {
  const rows: Transaction[] = [];
  let revision: string | null = null;
  let cursor: Transaction | undefined;
  for (;;) {
    const {
      data,
      error,
    }: {
      data: { revision: string; transactions: Transaction[] } | null;
      error: unknown;
    } = await client.rpc("get_portfolio_ledger_page", {
      expected_revision: revision,
      after_traded_on: cursor?.traded_on ?? null,
      after_created_at: cursor?.created_at ?? null,
      after_id: cursor?.id ?? null,
    });
    if (error) throw error;
    if (
      !data ||
      !Array.isArray(data.transactions) ||
      (revision !== null && revision !== data.revision) ||
      data.transactions.length > 500
    )
      throw new Error("Invalid ledger revision");
    revision = data.revision;
    const page: Transaction[] = data.transactions;
    if (page.length && page.at(-1)!.id === cursor?.id)
      throw new Error("Invalid ledger cursor");
    rows.push(...page);
    if (page.length < 500) return rows;
    cursor = page.at(-1);
  }
}
