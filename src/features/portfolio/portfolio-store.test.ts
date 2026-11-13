import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { AppError, ErrorCoordinator, type UpgradeReason } from "@/domain/errors";
import { parseServerRule } from "@/domain/errors/rules";
import type { PortfolioTransaction } from "@/domain/portfolio";

import { PortfolioStore } from "./portfolio-store";
import type { PortfolioRepository } from "./repository";

// Ported from iOS `PortfolioIdempotentSaveTests` and `PortfolioRefreshTests`.
const timeout = () => Object.assign(new Error("Failed to fetch"), { name: "TypeError" });
const now = Date.parse("2026-11-13T12:00:00+01:00");

let next = 0;
const purchase = (securityId: string, quantity: number, tradedOn = "2026-11-12"): PortfolioTransaction => ({
  id: `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`,
  securityId,
  kind: "buy",
  quantity: new Decimal(quantity),
  unitPrice: new Decimal(100),
  fees: new Decimal(0),
  tradedOn,
  createdAt: `${tradedOn}T09:00:${String(next).padStart(2, "0")}Z`,
});

/** Stores rows like `upsert(ignoreDuplicates)`; can lose answers after storing, fail one id once, or hold a read. */
class Ledger implements PortfolioRepository {
  stored: PortfolioTransaction[] = [];
  losingAnswers = 0;
  failingID: string | null = null;
  private held: { started: () => void; release: Promise<void> } | null = null;

  hold() {
    let started!: () => void;
    let release!: () => void;
    const reached = new Promise<void>((resolve) => (started = resolve));
    this.held = { started, release: new Promise((resolve) => (release = resolve)) };
    return { reached, release };
  }

  async read() {
    const rows = [...this.stored];
    const held = this.held;
    this.held = null;
    if (held) {
      held.started();
      await held.release;
    }
    return { transactions: rows, books: [], cash: [] };
  }

  async create(transaction: PortfolioTransaction) {
    if (transaction.id === this.failingID) {
      this.failingID = null;
      throw timeout();
    }
    if (!this.stored.some((item) => item.id === transaction.id)) this.stored.push(transaction);
    if (this.losingAnswers > 0) {
      this.losingAnswers -= 1;
      throw timeout();
    }
    return null;
  }

  async update(transaction: PortfolioTransaction) {
    this.stored = this.stored.map((item) => (item.id === transaction.id ? transaction : item));
    return null;
  }

  async delete(id: string) {
    this.stored = this.stored.filter((item) => item.id !== id);
    return null;
  }

  /** Free under enforcement: the server's `P0001 PLUS_REQUIRED`, as a server action reports it. */
  async createBook(): Promise<null> {
    throw new AppError("server", { operation: "portfolio.createBook", httpStatus: 400, rule: parseServerRule("P0001", "PLUS_REQUIRED", '{"feature":"portfolios"}') });
  }

  renameBook = async () => null;
  deleteBook = async () => null;
  createCash = async () => null;
  deleteCash = async () => null;
}

const store = (ledger: Ledger) => new PortfolioStore(ledger, new ErrorCoordinator(), undefined, () => now);
const ids = (store: PortfolioStore) => store.getSnapshot().transactions.map((item) => item.id).sort();

describe("PortfolioStore", () => {
  it("stores one record when a save is retried after a lost answer", async () => {
    const ledger = new Ledger();
    ledger.losingAnswers = 1;
    const portfolio = store(ledger);
    await portfolio.load();
    const record = purchase("bai", 1);
    expect(await portfolio.create(record)).toBe("failed");
    expect(await portfolio.create(record)).toBe("saved");
    expect(ledger.stored.map((item) => item.id)).toEqual([record.id]);
    expect(ids(portfolio)).toEqual([record.id]);
  });

  it("skips rows already saved when an import is retried", async () => {
    const ledger = new Ledger();
    const portfolio = store(ledger);
    await portfolio.load();
    const rows = [purchase("bai", 1, "2026-11-11"), purchase("bcga", 2)];
    ledger.failingID = rows[1].id;
    expect(await portfolio.importTransactions(rows)).toEqual({ saved: 1, result: "failed" });
    expect(await portfolio.importTransactions(rows)).toEqual({ saved: 2, result: "saved" });
    expect(ledger.stored.map((item) => item.id).sort()).toEqual(rows.map((item) => item.id).sort());
  });

  it("keeps the loaded ledger on suspension and drops the suspended read", async () => {
    const ledger = new Ledger();
    const original = purchase("bai", 1);
    ledger.stored = [original];
    const portfolio = store(ledger);
    await portfolio.load();
    const { reached, release } = ledger.hold();
    const old = portfolio.load();
    await reached;
    portfolio.suspend();
    expect(portfolio.getSnapshot()).toMatchObject({ status: "loaded", transactions: [original] });

    const added = purchase("bcga", 2);
    ledger.stored.push(added);
    await portfolio.load();
    release();
    await old;
    expect(ids(portfolio)).toEqual([original.id, added.id].sort());
    portfolio.reset();
    expect(portfolio.getSnapshot()).toMatchObject({ status: "idle", transactions: [] });
  });

  it("never lets a read started before an edit restore the old record", async () => {
    const ledger = new Ledger();
    const original = purchase("bai", 1);
    ledger.stored = [original];
    const portfolio = store(ledger);
    await portfolio.load();
    const { reached, release } = ledger.hold();
    const refresh = portfolio.load();
    await reached;
    const edited = { ...original, quantity: new Decimal(2) };
    expect(await portfolio.update(edited)).toBe("saved");
    release();
    await refresh;
    expect(portfolio.getSnapshot().transactions).toEqual([edited]);
  });

  it("refuses a change that would oversell before sending it", async () => {
    const ledger = new Ledger();
    const buy = purchase("bai", 1, "2026-11-10");
    ledger.stored = [buy];
    const portfolio = store(ledger);
    await portfolio.load();
    expect(await portfolio.create({ ...purchase("bai", 2), kind: "sell" })).toBe("oversell");
    expect(await portfolio.delete(buy.id)).toBe("saved");
  });

  it("opens the plan dialog for a plan rule instead of an error", async () => {
    const errors = new ErrorCoordinator();
    const reasons: UpgradeReason[] = [];
    const portfolio = new PortfolioStore(new Ledger(), errors, (reason) => reasons.push(reason), () => now);
    expect(await portfolio.createBook({ id: "00000000-0000-4000-8000-0000000000aa", name: "Reforma" })).toBe("upgrade");
    expect(reasons).toEqual(["portfolios"]);
    expect(errors.current).toBeNull();
    expect(portfolio.getSnapshot().books).toEqual([]);
  });
});
