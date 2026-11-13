import { type ErrorCoordinator, type UpgradeReason, isCancellation, mapError } from "@/domain/errors";
import type { PortfolioTransaction } from "@/domain/portfolio";
import type { PortfolioBook } from "@/domain/portfolio/books";
import { type CashMovement, newestCashFirst } from "@/domain/portfolio/cash";
import { type LedgerRefusal, newestFirst, permitsChange } from "@/domain/portfolio/records";

import type { PortfolioRepository } from "./repository";

/** The ledger is read again every minute while the page is visible. */
export const PORTFOLIO_REFRESH_MS = 60_000;

export type PortfolioStatus = "idle" | "loading" | "loaded" | "failed";

export interface PortfolioSnapshot {
  readonly status: PortfolioStatus;
  /** Newest first, every portfolio. */
  readonly transactions: readonly PortfolioTransaction[];
  /** Named portfolios, oldest first. */
  readonly books: readonly PortfolioBook[];
  /** Newest first, every portfolio. */
  readonly cash: readonly CashMovement[];
  readonly loadedAt: number | null;
}

/** `saved`, a §5.1 rule the server (or the same check here) refused, or a failure already shown. */
export type SaveResult = "saved" | LedgerRefusal | "failed";

/** `saved`, a name another portfolio already has, a plan rule (the plan dialog is open), or a failure already shown. */
export type BookResult = "saved" | "duplicate" | "upgrade" | "failed";

/**
 * The account's ledger, named portfolios and cash (iOS `PortfolioStore`). Writes are confirmed before they
 * show: each one waits for the server, then updates the lists. A read that started before a write, or
 * before `suspend`/`reset`, is discarded, so it can never bring back what the write replaced. A plan rule
 * opens the plan dialog instead of an error.
 */
export class PortfolioStore {
  private state: PortfolioSnapshot = { status: "idle", transactions: [], books: [], cash: [], loadedAt: null };
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  /** Bumped by `reset` only: a write in flight for the previous account changes nothing. */
  private account = 0;
  private writes = 0;
  private loading: Promise<void> | null = null;

  constructor(
    private readonly repository: PortfolioRepository,
    private readonly errors: ErrorCoordinator,
    private readonly upgrade: (reason: UpgradeReason) => void = () => {},
    private readonly now: () => number = Date.now,
  ) {}

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.state;

  private set(change: Partial<PortfolioSnapshot>) {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }

  /** Reads everything. `quiet` keeps a loaded ledger on screen and shows no error for it. */
  load({ quiet = false, signal }: { quiet?: boolean; signal?: AbortSignal } = {}): Promise<void> {
    if (this.loading) return this.loading;
    const task = this.read(this.generation, quiet, signal).finally(() => {
      if (this.loading === task) this.loading = null;
    });
    this.loading = task;
    return task;
  }

  private async read(token: number, quiet: boolean, signal?: AbortSignal) {
    if (this.state.status !== "loaded") this.set({ status: "loading" });
    for (;;) {
      const writes = this.writes;
      try {
        const { transactions, books, cash } = await this.repository.read(signal);
        if (token !== this.generation || signal?.aborted) return;
        // A write landed meanwhile: this answer may predate it.
        if (writes !== this.writes) continue;
        this.set({ status: "loaded", transactions: [...transactions].sort(newestFirst), books, cash: [...cash].sort(newestCashFirst), loadedAt: this.now() });
      } catch (error) {
        if (token !== this.generation) return;
        if (signal?.aborted || isCancellation(error)) {
          if (this.state.status === "loading") this.set({ status: "idle" });
          return;
        }
        if (this.state.status === "loaded" && quiet) return;
        if (this.state.status === "loaded") this.errors.present(error, "portfolio.load", { context: "refresh", retry: () => this.load() });
        else {
          this.errors.handle(error, "portfolio.load");
          this.set({ status: "failed" });
        }
      }
      return;
    }
  }

  /** Stops reads in flight (the page went away) and keeps what is shown. */
  suspend() {
    this.generation += 1;
    this.loading = null;
    if (this.state.status === "loading") this.set({ status: "idle" });
  }

  /** Another account: forgets everything. */
  reset() {
    this.generation += 1;
    this.account += 1;
    this.writes += 1;
    this.loading = null;
    this.set({ status: "idle", transactions: [], books: [], cash: [], loadedAt: null });
  }

  // MARK: Ledger

  create(transaction: PortfolioTransaction): Promise<SaveResult> {
    const next = [...this.state.transactions.filter((item) => item.id !== transaction.id), transaction];
    return this.ledgerWrite("portfolio.create", next, () => this.repository.create(transaction), () => this.replace(transaction));
  }

  update(transaction: PortfolioTransaction): Promise<SaveResult> {
    const next = this.state.transactions.map((item) => (item.id === transaction.id ? transaction : item));
    return this.ledgerWrite("portfolio.update", next, () => this.repository.update(transaction), () => this.replace(transaction));
  }

  delete(id: string): Promise<SaveResult> {
    const next = this.state.transactions.filter((item) => item.id !== id);
    return this.ledgerWrite("portfolio.delete", next, () => this.repository.delete(id), () =>
      this.set({ transactions: this.state.transactions.filter((item) => item.id !== id) }),
    );
  }

  /**
   * Saves oldest first and stops at the first refused write; resolves with how many of the rows are
   * now in the ledger. A retried import skips rows already saved.
   */
  async importTransactions(rows: readonly PortfolioTransaction[]): Promise<{ saved: number; result: SaveResult }> {
    let saved = 0;
    for (const row of rows) {
      if (this.state.transactions.some((item) => item.id === row.id)) {
        saved += 1;
        continue;
      }
      const result = await this.create(row);
      if (result !== "saved") return { saved, result };
      saved += 1;
    }
    return { saved, result: "saved" };
  }

  private replace(transaction: PortfolioTransaction) {
    this.set({ transactions: [...this.state.transactions.filter((item) => item.id !== transaction.id), transaction].sort(newestFirst) });
  }

  private async ledgerWrite(operation: string, next: readonly PortfolioTransaction[], send: () => Promise<LedgerRefusal | null>, apply: () => void): Promise<SaveResult> {
    // The same check as the server: a change that would make a valid ledger invalid is not sent.
    if (!permitsChange(this.state.transactions, next, this.now())) return "oversell";
    const result = await this.write(operation, send, (refusal) => {
      if (refusal) return refusal;
      apply();
      return "saved" as const;
    });
    return result === "upgrade" ? "failed" : result;
  }

  // MARK: Named portfolios

  createBook(book: PortfolioBook): Promise<BookResult> {
    return this.write("portfolio.createBook", () => this.repository.createBook(book), (refusal) => {
      if (refusal) return refusal;
      this.set({ books: [...this.state.books.filter((item) => item.id !== book.id), book] });
      return "saved";
    });
  }

  renameBook(book: PortfolioBook): Promise<BookResult> {
    return this.write("portfolio.renameBook", () => this.repository.renameBook(book), (refusal) => {
      if (refusal) return refusal;
      this.set({ books: this.state.books.map((item) => (item.id === book.id ? book : item)) });
      return "saved";
    });
  }

  /** The server removes the portfolio's records and cash with it; so does the list here. */
  deleteBook(id: string): Promise<BookResult> {
    return this.write("portfolio.deleteBook", () => this.repository.deleteBook(id), () => {
      this.set({
        books: this.state.books.filter((item) => item.id !== id),
        transactions: this.state.transactions.filter((item) => item.portfolioId !== id),
        cash: this.state.cash.filter((item) => item.portfolioId !== id),
      });
      return "saved";
    });
  }

  // MARK: Cash

  createCash(movement: CashMovement): Promise<BookResult> {
    return this.write("portfolio.createCash", () => this.repository.createCash(movement), () => {
      this.set({ cash: [...this.state.cash.filter((item) => item.id !== movement.id), movement].sort(newestCashFirst) });
      return "saved";
    });
  }

  deleteCash(id: string): Promise<BookResult> {
    return this.write("portfolio.deleteCash", () => this.repository.deleteCash(id), () => {
      this.set({ cash: this.state.cash.filter((item) => item.id !== id) });
      return "saved";
    });
  }

  /** Sends one write for this account; a plan rule opens the plan dialog, any other error is shown. */
  private async write<T, R>(operation: string, send: () => Promise<T>, apply: (value: T) => R): Promise<R | "upgrade" | "failed"> {
    const token = this.account;
    this.writes += 1;
    try {
      const value = await send();
      if (token !== this.account) return "failed";
      this.writes += 1;
      this.errors.resolve(operation);
      return apply(value);
    } catch (error) {
      if (token !== this.account || isCancellation(error)) return "failed";
      const upgrade = mapError(error, operation)?.rule?.upgrade;
      if (!upgrade) {
        this.errors.present(error, operation);
        return "failed";
      }
      this.upgrade(upgrade.reason);
      return "upgrade";
    }
  }
}
