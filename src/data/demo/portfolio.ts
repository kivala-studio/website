import "server-only";

import { cookies } from "next/headers";

import { createHash, randomBytes } from "node:crypto";

import { recordedSnapshot } from "@/data/market/demo/scenarios";
import { classifySecurityKind } from "@/domain/market/classification";
import type { PortfolioTransaction } from "@/domain/portfolio";
import { type PortfolioBook, decodeBook, hasBookNamed } from "@/domain/portfolio/books";
import { type CashMovementWire, cashIssues, decodeCashMovement, fromCashWire } from "@/domain/portfolio/cash";
import { type TransactionWire, decodeTransaction, fromWire, permitsChange, recordIssues } from "@/domain/portfolio/records";

import { COOKIE_OPTIONS, type DemoAccount, demoAccount } from "./account";
import { DEMO_COOKIES } from "./tiers";

/*
 * Demo mode's ledger, in a cookie of the same browser. `demo-portfolio-scenario` picks the starting
 * ledger: `full` (default), `partial` (one holding without a current quote), `empty`, `invalid`
 * (an oversell), or `shares` (`full` without the bond, so the weekly reading has every fact). Every write applies the server's rules (contract §5.1) and refuses with its errors.
 */
const LEDGER_COOKIE = DEMO_COOKIES[9];
export const DEMO_PORTFOLIO_SCENARIO_COOKIE = DEMO_COOKIES[10];
const [BOOKS_COOKIE, CASH_COOKIE, SHARES_COOKIE] = DEMO_COOKIES.slice(11);
export const DEMO_PORTFOLIO_SCENARIOS = ["full", "partial", "empty", "invalid", "shares"] as const;
type Scenario = (typeof DEMO_PORTFOLIO_SCENARIOS)[number];

/** A cookie holds about 4 KB: the demo keeps at most this many records. */
const LIMIT = 24;

const SECURITIES = new Map(
  recordedSnapshot.securities.map((security) => [
    security.id,
    {
      kind: classifySecurityKind({ type: security.security_type ?? "", name: security.name ?? undefined, symbol: security.symbol }),
      currency: security.currency ?? "AOA",
    },
  ]),
);

const BAI = "3c55bf40-8544-4598-bf76-15a165dbeff3";
const BCGA = "ec7084ad-90ac-4cd2-b481-1572d02e2488";
const BDVA = "51399e7d-8108-434a-b852-c6646a3e9579";
const BAI_BOND = "59c632cb-0072-4f56-95c8-650709d59615";
const UNQUOTED_BOND = "89b56ea1-2462-4375-8c36-9967ef56cb8b";

const row = (
  n: number,
  securityId: string,
  kind: TransactionWire["kind"],
  quantity: string,
  unitPrice: string,
  fees: string,
  tradedOn: string,
): TransactionWire => ({
  id: `d5e20000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  securityId,
  kind,
  quantity,
  unitPrice,
  fees,
  tradedOn,
  createdAt: `${tradedOn}T10:00:00.000Z`,
  portfolioId: null,
});

const FULL = [
  row(1, BAI, "buy", "10", "90000", "1500", "2026-03-02"),
  row(2, BAI_BOND, "buy", "500000", "101.5", "0", "2026-04-01"),
  row(3, BCGA, "buy", "50", "17500", "875", "2026-05-04"),
  row(4, BAI, "income", "1", "25000", "2500", "2026-06-15"),
  row(5, BCGA, "sell", "10", "19500", "300", "2026-08-03"),
  row(6, BDVA, "buy", "2", "95000", "0", "2026-09-01"),
];

function seeded(scenario: Scenario): TransactionWire[] {
  switch (scenario) {
    case "full":
      return FULL;
    case "partial":
      return [...FULL, row(7, UNQUOTED_BOND, "buy", "200000", "99", "0", "2026-07-01")];
    case "empty":
      return [];
    case "invalid":
      return [...FULL, row(7, BDVA, "sell", "5", "100000", "0", "2026-10-01")];
    case "shares":
      return FULL.filter((item) => item.securityId !== BAI_BOND);
  }
}

const sqlError = (code: string, message: string) => Object.assign(new Error(message), { code, message, details: null, hint: null, status: 400 });

type Stored = { revision: number; rows: TransactionWire[] };

async function read(): Promise<Stored> {
  const jar = await cookies();
  const value = jar.get(LEDGER_COOKIE)?.value;
  if (value !== undefined) {
    try {
      const parsed = JSON.parse(value) as { r?: unknown; t?: unknown };
      if (typeof parsed.r === "number" && Array.isArray(parsed.t)) {
        const rows = parsed.t.map((item) => {
          const [id, securityId, kind, quantity, unitPrice, fees, tradedOn, createdAt, portfolioId] = Array.isArray(item) ? item : [];
          return decodeTransaction({
            id,
            securityId,
            kind: { b: "buy", s: "sell", i: "income" }[kind as string],
            quantity,
            unitPrice,
            fees,
            tradedOn,
            createdAt,
            portfolioId: portfolioId || null,
          });
        });
        if (rows.every((item) => item !== null)) return { revision: parsed.r, rows: rows as TransactionWire[] };
      }
    } catch {
      // A damaged cookie starts over.
    }
  }
  const scenario = jar.get(DEMO_PORTFOLIO_SCENARIO_COOKIE)?.value;
  return { revision: 1, rows: seeded((DEMO_PORTFOLIO_SCENARIOS as readonly string[]).includes(scenario ?? "") ? (scenario as Scenario) : "full") };
}

async function save(stored: Stored): Promise<void> {
  if (stored.rows.length > LIMIT) throw sqlError("54000", "Demo ledger is full");
  const compact = stored.rows.map((item) => [
    item.id,
    item.securityId,
    item.kind[0],
    item.quantity,
    item.unitPrice,
    item.fees,
    item.tradedOn,
    item.createdAt,
    item.portfolioId ?? 0,
  ]);
  (await cookies()).set(LEDGER_COOKIE, JSON.stringify({ r: stored.revision + 1, t: compact }), COOKIE_OPTIONS);
}

export async function demoLedger(): Promise<{ revision: string; transactions: TransactionWire[] }> {
  const { revision, rows } = await read();
  return { revision: String(revision), transactions: rows };
}

/** The server's checks (contract §5.1) for a ledger that changes from `before` to `after`. */
function check(before: readonly TransactionWire[], after: readonly TransactionWire[], changed: TransactionWire | null, now: number) {
  if (changed) {
    const issues = recordIssues(fromWire(changed), SECURITIES.get(changed.securityId), now);
    if (issues.includes("futureDate")) throw sqlError("22007", "portfolio transaction date cannot be in the future");
    if (issues.some((issue) => issue === "unsupported" || issue === "wholeQuantity" || issue === "overflow"))
      throw sqlError("23514", "Unsupported portfolio instrument or quantity");
    const constraint = issues.includes("taxExceedsGross") || (changed.kind === "income" && issues.includes("quantity")) ? "income_shape" : "check";
    if (issues.length > 0)
      throw sqlError("23514", `new row for relation "portfolio_transactions" violates check constraint "portfolio_transactions_${constraint}"`);
  }
  const ledger = (rows: readonly TransactionWire[]): PortfolioTransaction[] => rows.map(fromWire);
  if (!permitsChange(ledger(before), ledger(after), now)) throw sqlError("23514", "Portfolio sale exceeds holdings");
}

export async function demoCreateTransaction(transaction: TransactionWire, now: number): Promise<void> {
  const stored = await read();
  if (stored.rows.some((item) => item.id === transaction.id)) return;
  if (transaction.portfolioId && !(await demoBooks()).some((book) => book.id === transaction.portfolioId)) throw sqlError("23503", "Portfolio not found");
  const created = { ...transaction, createdAt: new Date(now).toISOString() };
  const rows = [...stored.rows, created];
  check(stored.rows, rows, created, now);
  await save({ revision: stored.revision, rows });
}

export async function demoUpdateTransaction(transaction: TransactionWire, now: number): Promise<void> {
  const stored = await read();
  const previous = stored.rows.find((item) => item.id === transaction.id);
  if (!previous) return;
  if (previous.securityId !== transaction.securityId || previous.portfolioId !== transaction.portfolioId)
    throw sqlError("23514", "Portfolio transaction identity cannot change");
  const updated = { ...transaction, createdAt: previous.createdAt };
  const rows = stored.rows.map((item) => (item.id === transaction.id ? updated : item));
  check(stored.rows, rows, updated, now);
  await save({ revision: stored.revision, rows });
}

export async function demoDeleteTransaction(id: string, now: number): Promise<void> {
  const stored = await read();
  const rows = stored.rows.filter((item) => item.id !== id);
  if (rows.length === stored.rows.length) return;
  check(stored.rows, rows, null, now);
  await save({ revision: stored.revision, rows });
}

// MARK: Named portfolios, cash and share links (contract §5.2–5.4), with the server's plan rules

const demoRule = (message: string, details: Record<string, unknown>) =>
  Object.assign(new Error(message), { code: "P0001", message, details: JSON.stringify(details), hint: null, status: 400 });

const BOOK_LIMIT = 9;
const SHARE_LIMIT = 20;
/** Cookie room, not a server rule. */
const CASH_ROOM = 30;

async function readList<T>(name: string, decode: (value: unknown) => T | null): Promise<T[]> {
  try {
    const parsed = JSON.parse((await cookies()).get(name)?.value ?? "[]") as unknown;
    const rows = Array.isArray(parsed) ? parsed.map(decode) : [];
    return rows.every((row) => row !== null) ? (rows as T[]) : [];
  } catch {
    return [];
  }
}

const writeList = async (name: string, rows: readonly unknown[]) => (await cookies()).set(name, JSON.stringify(rows), COOKIE_OPTIONS);

export const demoBooks = () => readList(BOOKS_COOKIE, decodeBook);

export async function demoCreateBook(account: DemoAccount, book: PortfolioBook): Promise<void> {
  const books = await demoBooks();
  if (books.some((item) => item.id === book.id)) return;
  if (account.tier === "free") throw demoRule("PLUS_REQUIRED", { feature: "portfolios" });
  if (books.length >= BOOK_LIMIT) throw demoRule("PORTFOLIO_LIMIT", { feature: "portfolios", limit: BOOK_LIMIT });
  if (hasBookNamed(books, book.name)) throw sqlError("23505", 'duplicate key value violates unique constraint "portfolios_user_name_key"');
  await writeList(BOOKS_COOKIE, [...books, book]);
}

export async function demoRenameBook(book: PortfolioBook): Promise<void> {
  const books = await demoBooks();
  if (hasBookNamed(books, book.name, book.id)) throw sqlError("23505", 'duplicate key value violates unique constraint "portfolios_user_name_key"');
  await writeList(
    BOOKS_COOKIE,
    books.map((item) => (item.id === book.id ? book : item)),
  );
}

/** Cascades like the server: the portfolio's records, cash movements and share links go with it. */
export async function demoDeleteBook(id: string): Promise<void> {
  const books = await demoBooks();
  if (!books.some((book) => book.id === id)) return;
  const stored = await read();
  await save({ revision: stored.revision, rows: stored.rows.filter((row) => row.portfolioId !== id) });
  await writeList(
    CASH_COOKIE,
    (await demoCash()).filter((movement) => movement.portfolioId !== id),
  );
  await writeList(
    SHARES_COOKIE,
    (await readShares()).filter((share) => share.portfolioId !== id),
  );
  await writeList(
    BOOKS_COOKIE,
    books.filter((book) => book.id !== id),
  );
}

export const demoCash = () => readList(CASH_COOKIE, decodeCashMovement);

export async function demoCreateCash(account: DemoAccount, movement: CashMovementWire, now: number): Promise<void> {
  const cash = await demoCash();
  if (cash.some((item) => item.id === movement.id)) return;
  if (account.tier === "free") throw demoRule("PLUS_REQUIRED", { feature: "cash" });
  if (cashIssues(fromCashWire(movement), now).includes("futureDate")) throw sqlError("23514", "Cash movement cannot be in the future");
  if (movement.portfolioId && !(await demoBooks()).some((book) => book.id === movement.portfolioId)) throw sqlError("23503", "Portfolio not found");
  if (cash.length >= CASH_ROOM) throw sqlError("54000", "Demo cash list is full");
  await writeList(CASH_COOKIE, [...cash, movement]);
}

export async function demoDeleteCash(id: string): Promise<void> {
  await writeList(
    CASH_COOKIE,
    (await demoCash()).filter((movement) => movement.id !== id),
  );
}

type DemoShare = { id: string; label: string; createdAt: string; portfolioId: string | null; hash: string };

function decodeShare(value: unknown): DemoShare | null {
  const row = (value ?? {}) as Record<string, unknown>;
  const portfolioId = row.portfolioId ?? null;
  if (typeof row.id !== "string" || typeof row.label !== "string" || typeof row.createdAt !== "string" || typeof row.hash !== "string") return null;
  if (portfolioId !== null && typeof portfolioId !== "string") return null;
  return { id: row.id, label: row.label, createdAt: row.createdAt, portfolioId, hash: row.hash };
}

const readShares = () => readList(SHARES_COOKIE, decodeShare);
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function demoShares(portfolioId: string | null): Promise<{ id: string; label: string; createdAt: string }[]> {
  return (await readShares())
    .filter((share) => share.portfolioId === portfolioId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(({ id, label, createdAt }) => ({ id, label, createdAt }));
}

/** Like the server, only the token's hash is kept; the token itself is returned once. */
export async function demoCreateShare(account: DemoAccount, portfolioId: string | null, label: string, now: number): Promise<string> {
  if (account.tier === "free") throw demoRule("PLUS_REQUIRED", { feature: "clientViews" });
  if (portfolioId && !(await demoBooks()).some((book) => book.id === portfolioId)) throw demoRule("PORTFOLIO_NOT_FOUND", {});
  const trimmed = label.trim();
  if (trimmed.length < 1 || [...trimmed].length > 40) throw sqlError("22023", "Share label must be 1 to 40 characters");
  const shares = await readShares();
  if (shares.length >= SHARE_LIMIT) throw demoRule("SHARE_LIMIT", { limit: SHARE_LIMIT });
  const token = randomBytes(24).toString("base64url");
  await writeList(SHARES_COOKIE, [
    ...shares,
    { id: crypto.randomUUID(), label: trimmed, createdAt: new Date(now).toISOString(), portfolioId, hash: tokenHash(token) },
  ]);
  return token;
}

export async function demoRevokeShare(id: string): Promise<void> {
  await writeList(
    SHARES_COOKIE,
    (await readShares()).filter((share) => share.id !== id),
  );
}

/** `get_shared_portfolio` for a link made in this browser: null when unknown, revoked, or the owner is no longer Plus. */
export async function demoCreatedSharedPortfolio(token: string): Promise<unknown> {
  const share = (await readShares()).find((item) => item.hash === tokenHash(token));
  if (!share || ((await demoAccount())?.tier ?? "free") === "free") return null;
  const { rows } = await read();
  const name = share.portfolioId ? ((await demoBooks()).find((book) => book.id === share.portfolioId)?.name ?? null) : null;
  return {
    portfolio: name,
    transactions: rows
      .filter((row) => (row.portfolioId ?? null) === share.portfolioId)
      .map((row) => ({
        id: row.id,
        security_id: row.securityId,
        transaction_kind: row.kind,
        quantity: row.quantity,
        unit_price: row.unitPrice,
        fees: row.fees,
        traded_on: row.tradedOn,
        created_at: row.createdAt,
      })),
  };
}
