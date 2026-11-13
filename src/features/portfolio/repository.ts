import { DecodingError } from "@/domain/errors";
import type { PortfolioTransaction } from "@/domain/portfolio";
import { type LedgerRefusal, decodeTransaction, fromWire, toWire } from "@/domain/portfolio/records";
import { readAccountRoute, settle } from "@/features/account/results";

import { createPortfolioTransaction, deletePortfolioTransaction, updatePortfolioTransaction } from "./actions";

/** `portfolio_transactions` (contract §5.1). `create` ignores a record that already has its id. */
export interface PortfolioRepository {
  read(signal?: AbortSignal): Promise<PortfolioTransaction[]>;
  /** Resolves with the rule the server refused, or null once saved. */
  create(transaction: PortfolioTransaction): Promise<LedgerRefusal | null>;
  update(transaction: PortfolioTransaction): Promise<LedgerRefusal | null>;
  delete(id: string): Promise<LedgerRefusal | null>;
}

/** The ledger through `/api/account/portfolio` and its server actions, for one signed-in account. */
export function accountPortfolioRepository(userID: string): PortfolioRepository {
  return {
    async read(signal) {
      const body = await readAccountRoute("/api/account/portfolio", userID, signal);
      if (!Array.isArray(body.transactions)) throw new DecodingError("portfolio.ledger");
      return body.transactions.map((row) => {
        const wire = decodeTransaction(row);
        if (!wire) throw new DecodingError("portfolio.ledger");
        return fromWire(wire);
      });
    },
    create: (transaction) => settle(createPortfolioTransaction(userID, toWire(transaction)), "portfolio.create"),
    update: (transaction) => settle(updatePortfolioTransaction(userID, toWire(transaction)), "portfolio.update"),
    delete: (id) => settle(deletePortfolioTransaction(userID, id), "portfolio.delete"),
  };
}
