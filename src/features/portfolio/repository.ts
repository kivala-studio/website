import { DecodingError } from "@/domain/errors";
import type { PortfolioTransaction } from "@/domain/portfolio";
import { type PortfolioBook, decodeBook } from "@/domain/portfolio/books";
import { type CashMovement, decodeCashMovement, fromCashWire, toCashWire } from "@/domain/portfolio/cash";
import { type LedgerRefusal, decodeTransaction, fromWire, toWire } from "@/domain/portfolio/records";
import { readAccountRoute, settle } from "@/features/account/results";

import {
  createCashMovement,
  createPortfolioBook,
  createPortfolioShare,
  createPortfolioTransaction,
  deleteCashMovement,
  deletePortfolioBook,
  deletePortfolioTransaction,
  renamePortfolioBook,
  revokePortfolioShare,
  updatePortfolioTransaction,
} from "./actions";

export type PortfolioData = { transactions: PortfolioTransaction[]; books: PortfolioBook[]; cash: CashMovement[] };

/** `portfolio_transactions`, `portfolios` and `portfolio_cash_movements` (contract §5.1–5.3). Creates ignore an id already saved. */
export interface PortfolioRepository {
  read(signal?: AbortSignal): Promise<PortfolioData>;
  /** Resolves with the rule the server refused, or null once saved. */
  create(transaction: PortfolioTransaction): Promise<LedgerRefusal | null>;
  update(transaction: PortfolioTransaction): Promise<LedgerRefusal | null>;
  delete(id: string): Promise<LedgerRefusal | null>;
  /** `duplicate` when another portfolio has the name. */
  createBook(book: PortfolioBook): Promise<"duplicate" | null>;
  renameBook(book: PortfolioBook): Promise<"duplicate" | null>;
  deleteBook(id: string): Promise<unknown>;
  createCash(movement: CashMovement): Promise<unknown>;
  deleteCash(id: string): Promise<unknown>;
}

const list = <T, W>(value: unknown, decode: (row: unknown) => W | null, map: (wire: W) => T): T[] => {
  if (!Array.isArray(value)) throw new DecodingError("portfolio.read");
  return value.map((row) => {
    const wire = decode(row);
    if (!wire) throw new DecodingError("portfolio.read");
    return map(wire);
  });
};

/** Everything through `/api/account/portfolio` and its server actions, for one signed-in account. */
export function accountPortfolioRepository(userID: string): PortfolioRepository {
  return {
    async read(signal) {
      const body = await readAccountRoute("/api/account/portfolio", userID, signal);
      return {
        transactions: list(body.transactions, decodeTransaction, fromWire),
        books: list(body.books ?? [], decodeBook, (book) => book),
        cash: list(body.cash ?? [], decodeCashMovement, fromCashWire),
      };
    },
    create: (transaction) => settle(createPortfolioTransaction(userID, toWire(transaction)), "portfolio.create"),
    update: (transaction) => settle(updatePortfolioTransaction(userID, toWire(transaction)), "portfolio.update"),
    delete: (id) => settle(deletePortfolioTransaction(userID, id), "portfolio.delete"),
    createBook: (book) => settle(createPortfolioBook(userID, book), "portfolio.createBook"),
    renameBook: (book) => settle(renamePortfolioBook(userID, book), "portfolio.renameBook"),
    deleteBook: (id) => settle(deletePortfolioBook(userID, id), "portfolio.deleteBook"),
    createCash: (movement) => settle(createCashMovement(userID, toCashWire(movement)), "portfolio.createCash"),
    deleteCash: (id) => settle(deleteCashMovement(userID, id), "portfolio.deleteCash"),
  };
}

export type PortfolioShare = { id: string; label: string; createdAt: string };

/** One portfolio's read-only links (contract §5.4). The token of a new link is returned once and kept nowhere. */
export function accountShareRepository(userID: string) {
  return {
    async list(portfolioId: string | null, signal?: AbortSignal): Promise<PortfolioShare[]> {
      const body = await readAccountRoute(`/api/account/portfolio/shares?portfolio=${portfolioId ?? "main"}`, userID, signal);
      if (!Array.isArray(body.shares)) throw new DecodingError("portfolio.shares");
      return body.shares as PortfolioShare[];
    },
    create: (portfolioId: string | null, label: string) => settle(createPortfolioShare(userID, portfolioId, label), "portfolio.createShare"),
    revoke: (id: string) => settle(revokePortfolioShare(userID, id), "portfolio.revokeShare"),
  };
}
