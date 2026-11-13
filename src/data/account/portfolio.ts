import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DecodingError } from "@/domain/errors";
import { type PortfolioBook, decodeBook } from "@/domain/portfolio/books";
import { type CashMovementWire, decodeCashMovement } from "@/domain/portfolio/cash";
import { type TransactionWire, decodeTransaction } from "@/domain/portfolio/records";

import { readAll, unwrap } from "../supabase/read";

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
        portfolio_id: transaction.portfolioId,
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

// MARK: Named portfolios (contract §5.2)

export async function readBooks(client: SupabaseClient, userID: string): Promise<PortfolioBook[]> {
  const rows = await readAll<unknown>((from, to) => client.from("portfolios").select("id,name").eq("user_id", userID).order("created_at").order("id").range(from, to));
  return rows.map((row) => decodeBook(row) ?? fail("portfolio.books"));
}

/** Creates with the client's id; a repeated create is ignored. `PLUS_REQUIRED`, `PORTFOLIO_LIMIT` and a duplicate name (`23505`) come back as errors. */
export async function createBook(client: SupabaseClient, userID: string, book: PortfolioBook): Promise<void> {
  unwrap(await client.from("portfolios").upsert({ id: book.id, user_id: userID, name: book.name }, { onConflict: "id", ignoreDuplicates: true }));
}

export async function renameBook(client: SupabaseClient, userID: string, book: PortfolioBook): Promise<void> {
  unwrap(await client.from("portfolios").update({ name: book.name }).eq("user_id", userID).eq("id", book.id));
}

/** The server deletes the portfolio's records, cash movements and share links with it. */
export async function deleteBook(client: SupabaseClient, userID: string, id: string): Promise<void> {
  unwrap(await client.from("portfolios").delete().eq("user_id", userID).eq("id", id));
}

// MARK: Cash (contract §5.3)

export async function readCash(client: SupabaseClient, userID: string): Promise<CashMovementWire[]> {
  const rows = await readAll<unknown>((from, to) =>
    client.from("portfolio_cash_movements").select("id,kind,amount,occurred_on,portfolio_id").eq("user_id", userID).order("occurred_on").order("id").range(from, to),
  );
  return rows.map((row) => decodeCashMovement(row) ?? fail("portfolio.cash"));
}

/** Creates with the client's id; a repeated save is ignored. Free under enforcement raises `PLUS_REQUIRED`. */
export async function createCash(client: SupabaseClient, userID: string, movement: CashMovementWire): Promise<void> {
  unwrap(
    await client.from("portfolio_cash_movements").upsert(
      { id: movement.id, user_id: userID, portfolio_id: movement.portfolioId, kind: movement.kind, amount: movement.amount, occurred_on: movement.occurredOn },
      { onConflict: "id", ignoreDuplicates: true },
    ),
  );
}

export async function deleteCash(client: SupabaseClient, userID: string, id: string): Promise<void> {
  unwrap(await client.from("portfolio_cash_movements").delete().eq("user_id", userID).eq("id", id));
}

// MARK: Share links (contract §5.4)

export type ShareRow = { id: string; label: string; createdAt: string };

/** Explicit columns: `token_hash` is not granted, so `select=*` fails. Newest first. */
export async function readShares(client: SupabaseClient, userID: string, portfolioId: string | null): Promise<ShareRow[]> {
  const query = client.from("portfolio_shares").select("id,label,created_at").eq("user_id", userID);
  const rows = unwrap(await (portfolioId ? query.eq("portfolio_id", portfolioId) : query.is("portfolio_id", null)).order("created_at", { ascending: false })) as unknown[];
  return (rows ?? []).map((value) => {
    const row = (value ?? {}) as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.label !== "string" || typeof row.created_at !== "string") return fail("portfolio.shares");
    return { id: row.id, label: row.label, createdAt: row.created_at };
  });
}

/** The token exists only in this answer; only its hash is stored. The main portfolio is an explicit null. */
export async function createShare(client: SupabaseClient, portfolioId: string | null, label: string): Promise<string> {
  const body = unwrap(await client.rpc("create_portfolio_share", { share_portfolio_id: portfolioId, share_label: label })) as { token?: unknown } | null;
  if (typeof body?.token !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(body.token)) return fail("portfolio.share");
  return body.token;
}

export async function revokeShare(client: SupabaseClient, userID: string, id: string): Promise<void> {
  unwrap(await client.from("portfolio_shares").delete().eq("user_id", userID).eq("id", id));
}

function fail(operation: string): never {
  throw new DecodingError(operation);
}
