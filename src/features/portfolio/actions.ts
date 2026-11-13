"use server";

import {
  createBook,
  createCash,
  createShare,
  createTransaction,
  deleteBook,
  deleteCash,
  deleteTransaction,
  renameBook,
  revokeShare,
  updateTransaction,
} from "@/data/account/portfolio";
import { type AccountSession, isUUID } from "@/data/account/session";
import {
  demoCreateBook,
  demoCreateCash,
  demoCreateShare,
  demoCreateTransaction,
  demoDeleteBook,
  demoDeleteCash,
  demoDeleteTransaction,
  demoRenameBook,
  demoRevokeShare,
  demoUpdateTransaction,
} from "@/data/demo/portfolio";
import { type PortfolioBook, bookName } from "@/domain/portfolio/books";
import { type CashMovementWire, decodeCashMovement } from "@/domain/portfolio/cash";
import { type LedgerRefusal, type TransactionWire, decodeTransaction, ledgerRefusal } from "@/domain/portfolio/records";
import { type AccountResult, accountWrite, invalidArgument } from "@/features/account/write";

function decoded(wire: TransactionWire): TransactionWire {
  const transaction = decodeTransaction(wire);
  if (!transaction || !isUUID(transaction.id) || !isUUID(transaction.securityId)) throw invalidArgument();
  return transaction;
}

/** Runs one ledger write; a §5.1 rule the server enforces comes back as a value the editor shows inline. */
function ledgerWrite(expectedUserID: string, operation: string, run: (session: AccountSession, now: number) => Promise<void>) {
  return accountWrite<LedgerRefusal | null>(expectedUserID, operation, async (session) => {
    try {
      await run(session, Date.now());
      return null;
    } catch (error) {
      const refusal = ledgerRefusal(error);
      if (refusal) return refusal;
      throw error;
    }
  });
}

/** Creates with the client's id: repeating a save after a lost answer stores one record. */
export async function createPortfolioTransaction(expectedUserID: string, wire: TransactionWire): Promise<AccountResult<LedgerRefusal | null>> {
  return ledgerWrite(expectedUserID, "portfolio.create", async (session, now) => {
    const transaction = decoded(wire);
    if (session.kind === "demo") await demoCreateTransaction(transaction, now);
    else await createTransaction(session.client, session.userID, transaction);
  });
}

export async function updatePortfolioTransaction(expectedUserID: string, wire: TransactionWire): Promise<AccountResult<LedgerRefusal | null>> {
  return ledgerWrite(expectedUserID, "portfolio.update", async (session, now) => {
    const transaction = decoded(wire);
    if (session.kind === "demo") await demoUpdateTransaction(transaction, now);
    else await updateTransaction(session.client, session.userID, transaction);
  });
}

export async function deletePortfolioTransaction(expectedUserID: string, id: string): Promise<AccountResult<LedgerRefusal | null>> {
  return ledgerWrite(expectedUserID, "portfolio.delete", async (session, now) => {
    if (!isUUID(id)) throw invalidArgument();
    if (session.kind === "demo") await demoDeleteTransaction(id, now);
    else await deleteTransaction(session.client, session.userID, id);
  });
}

// MARK: Named portfolios, cash and share links

/** Writes whose refusal is a value, not an error: a duplicate portfolio name (`23505`). */
export async function createPortfolioBook(expectedUserID: string, book: PortfolioBook): Promise<AccountResult<"duplicate" | null>> {
  return accountWrite(expectedUserID, "portfolio.createBook", async (session) => {
    const name = bookName(book.name);
    if (!isUUID(book.id) || !name) throw invalidArgument();
    return duplicateAsValue(() => (session.kind === "demo" ? demoCreateBook(session.account, { id: book.id, name }) : createBook(session.client, session.userID, { id: book.id, name })));
  });
}

export async function renamePortfolioBook(expectedUserID: string, book: PortfolioBook): Promise<AccountResult<"duplicate" | null>> {
  return accountWrite(expectedUserID, "portfolio.renameBook", async (session) => {
    const name = bookName(book.name);
    if (!isUUID(book.id) || !name) throw invalidArgument();
    return duplicateAsValue(() => (session.kind === "demo" ? demoRenameBook({ id: book.id, name }) : renameBook(session.client, session.userID, { id: book.id, name })));
  });
}

export async function deletePortfolioBook(expectedUserID: string, id: string): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, "portfolio.deleteBook", async (session) => {
    if (!isUUID(id)) throw invalidArgument();
    if (session.kind === "demo") await demoDeleteBook(id);
    else await deleteBook(session.client, session.userID, id);
    return null;
  });
}

async function duplicateAsValue(run: () => Promise<void>): Promise<"duplicate" | null> {
  try {
    await run();
    return null;
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505") return "duplicate";
    throw error;
  }
}

export async function createCashMovement(expectedUserID: string, wire: CashMovementWire): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, "portfolio.createCash", async (session) => {
    const movement = decodeCashMovement(wire);
    if (!movement) throw invalidArgument();
    if (session.kind === "demo") await demoCreateCash(session.account, movement, Date.now());
    else await createCash(session.client, session.userID, movement);
    return null;
  });
}

export async function deleteCashMovement(expectedUserID: string, id: string): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, "portfolio.deleteCash", async (session) => {
    if (!isUUID(id)) throw invalidArgument();
    if (session.kind === "demo") await demoDeleteCash(id);
    else await deleteCash(session.client, session.userID, id);
    return null;
  });
}

/** The new link's token, returned once and never stored here. */
export async function createPortfolioShare(expectedUserID: string, portfolioId: string | null, label: string): Promise<AccountResult<string>> {
  return accountWrite(expectedUserID, "portfolio.createShare", async (session) => {
    const trimmed = label.trim();
    if ((portfolioId !== null && !isUUID(portfolioId)) || trimmed.length === 0 || [...trimmed].length > 40) throw invalidArgument();
    return session.kind === "demo" ? demoCreateShare(session.account, portfolioId, trimmed, Date.now()) : createShare(session.client, portfolioId, trimmed);
  });
}

export async function revokePortfolioShare(expectedUserID: string, id: string): Promise<AccountResult<null>> {
  return accountWrite(expectedUserID, "portfolio.revokeShare", async (session) => {
    if (!isUUID(id)) throw invalidArgument();
    if (session.kind === "demo") await demoRevokeShare(id);
    else await revokeShare(session.client, session.userID, id);
    return null;
  });
}
