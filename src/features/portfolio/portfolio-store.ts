import { type ErrorCoordinator, isCancellation } from "@/domain/errors";
import type { PortfolioTransaction } from "@/domain/portfolio";
import { type LedgerRefusal, newestFirst, permitsChange } from "@/domain/portfolio/records";

import type { PortfolioRepository } from "./repository";

/** The ledger is read again every minute while the page is visible. */
export const PORTFOLIO_REFRESH_MS = 60_000;

export type PortfolioStatus = "idle" | "loading" | "loaded" | "failed";

export interface PortfolioSnapshot {
  readonly status: PortfolioStatus;
  /** Newest first. */
  readonly transactions: readonly PortfolioTransaction[];
  readonly loadedAt: number | null;
}

/** `saved`, a §5.1 rule the server (or the same check here) refused, or a failure already shown. */
export type SaveResult = "saved" | LedgerRefusal | "failed";

/**
 * The account's ledger (iOS `PortfolioStore`). Writes are confirmed before they show: each one waits for
 * the server, then updates the list. A read that started before a write, or before `suspend`/`reset`,
 * is discarded, so it can never bring back what the write replaced.
 */
export class PortfolioStore {
  private state: PortfolioSnapshot = { status: "idle", transactions: [], loadedAt: null };
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  /** Bumped by `reset` only: a write in flight for the previous account changes nothing. */
  private account = 0;
  private writes = 0;
  private loading: Promise<void> | null = null;

  constructor(
    private readonly repository: PortfolioRepository,
    private readonly errors: ErrorCoordinator,
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

  /** Reads the whole ledger. `quiet` keeps a loaded ledger on screen and shows no error for it. */
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
        const transactions = await this.repository.read(signal);
        if (token !== this.generation || signal?.aborted) return;
        // A write landed meanwhile: this answer may predate it.
        if (writes !== this.writes) continue;
        this.set({ status: "loaded", transactions: [...transactions].sort(newestFirst), loadedAt: this.now() });
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
    this.set({ status: "idle", transactions: [], loadedAt: null });
  }

  create(transaction: PortfolioTransaction): Promise<SaveResult> {
    const next = [...this.state.transactions.filter((item) => item.id !== transaction.id), transaction];
    return this.write("portfolio.create", next, () => this.repository.create(transaction), () => this.replace(transaction));
  }

  update(transaction: PortfolioTransaction): Promise<SaveResult> {
    const next = this.state.transactions.map((item) => (item.id === transaction.id ? transaction : item));
    return this.write("portfolio.update", next, () => this.repository.update(transaction), () => this.replace(transaction));
  }

  delete(id: string): Promise<SaveResult> {
    const next = this.state.transactions.filter((item) => item.id !== id);
    return this.write("portfolio.delete", next, () => this.repository.delete(id), () =>
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

  private async write(operation: string, next: readonly PortfolioTransaction[], send: () => Promise<LedgerRefusal | null>, apply: () => void): Promise<SaveResult> {
    // The same check as the server: a change that would make a valid ledger invalid is not sent.
    if (!permitsChange(this.state.transactions, next, this.now())) return "oversell";
    const token = this.account;
    this.writes += 1;
    try {
      const refusal = await send();
      if (token !== this.account) return "failed";
      this.writes += 1;
      if (refusal) return refusal;
      this.errors.resolve(operation);
      apply();
      return "saved";
    } catch (error) {
      if (token !== this.account || isCancellation(error)) return "failed";
      this.errors.present(error, operation);
      return "failed";
    }
  }
}
