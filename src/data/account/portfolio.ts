import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DecodingError } from "@/domain/errors";
import { type TransactionWire, decodeTransaction } from "@/domain/portfolio/records";

import { unwrap } from "../supabase/read";

/** `get_portfolio_ledger_page` rows per page (contract §5.1). */
export const LEDGER_PAGE_SIZE = 500;
const RESTARTS = 3;

export type Ledger = { revision: string; transactions: TransactionWire[] };

type Page = { revision: string; rows: unknown[] };

const isChanged = (error: unknown) => typeof error === "object" && error !== null && (error as { code?: unknown }).code === "PT409";

function decodePage(body: unknown): Page {
  const value = (body ?? {}) as { revision?: unknown; transactions?: unknown };
  const revision = typeof value.revision === "number" ? String(value.revision) : value.revision;
  if (typeof revision !== "string" || revision === "" || !Array.isArray(value.transactions)) throw new DecodingError("portfolio.ledger");
  if (value.transactions.length > LEDGER_PAGE_SIZE) throw new DecodingError("portfolio.ledger");
  return { revision, rows: value.transactions };
}

/**
 * The whole ledger at one revision: 500-row keyset pages tied to the first page's revision. A write
 * between pages (`PT409`, or a different revision) restarts from page one; a malformed row rejects it all.
 */
type PageReader = (args: Record<string, string>) => PromiseLike<{ data: unknown; error: unknown; status?: number }>;

export async function readLedger(client: SupabaseClient, readPage: PageReader = (args) => client.rpc("get_portfolio_ledger_page", args)): Promise<Ledger> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await readPages(readPage);
    } catch (error) {
      if (!(isChanged(error) || error instanceof LedgerChanged) || attempt >= RESTARTS) throw error;
    }
  }
}

class LedgerChanged extends Error {}

async function readPages(readPage: PageReader): Promise<Ledger> {
  const transactions: TransactionWire[] = [];
  let revision: string | undefined;
  for (;;) {
    const last = transactions.at(-1);
    const args: Record<string, string> = revision && last ? { expected_revision: revision, after_traded_on: last.tradedOn, after_created_at: last.createdAt, after_id: last.id } : {};
    const page = decodePage(unwrap(await readPage(args)));
    if (revision !== undefined && page.revision !== revision) throw new LedgerChanged();
    revision = page.revision;
    for (const row of page.rows) {
      const transaction = decodeTransaction(row);
      if (!transaction) throw new DecodingError("portfolio.ledger");
      transactions.push(transaction);
    }
    if (page.rows.length < LEDGER_PAGE_SIZE) return { revision, transactions };
  }
}

/** Inserts with the client's id; a repeated save of the same id (after a lost answer) changes nothing. */
export async function createTransaction(client: SupabaseClient, userID: string, transaction: TransactionWire): Promise<void> {
  unwrap(
    await client.from("portfolio_transactions").upsert(
      {
        id: transaction.id,
        user_id: userID,
        security_id: transaction.securityId,
        transaction_kind: transaction.kind,
        quantity: transaction.quantity,
        unit_price: transaction.unitPrice,
        fees: transaction.fees,
        traded_on: transaction.tradedOn,
      },
      { onConflict: "id", ignoreDuplicates: true },
    ),
  );
}

/** Only the editable fields: identity columns are immutable on the server. */
export async function updateTransaction(client: SupabaseClient, userID: string, transaction: TransactionWire): Promise<void> {
  unwrap(
    await client
      .from("portfolio_transactions")
      .update({ transaction_kind: transaction.kind, quantity: transaction.quantity, unit_price: transaction.unitPrice, fees: transaction.fees, traded_on: transaction.tradedOn })
      .eq("user_id", userID)
      .eq("id", transaction.id),
  );
}

export async function deleteTransaction(client: SupabaseClient, userID: string, id: string): Promise<void> {
  unwrap(await client.from("portfolio_transactions").delete().eq("user_id", userID).eq("id", id));
}
