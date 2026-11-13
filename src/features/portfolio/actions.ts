"use server";

import { createTransaction, deleteTransaction, updateTransaction } from "@/data/account/portfolio";
import { type AccountSession, isUUID } from "@/data/account/session";
import { demoCreateTransaction, demoDeleteTransaction, demoUpdateTransaction } from "@/data/demo/portfolio";
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
