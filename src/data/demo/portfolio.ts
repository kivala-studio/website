import "server-only";

import { cookies } from "next/headers";

import { recordedSnapshot } from "@/data/market/demo/scenarios";
import { classifySecurityKind } from "@/domain/market/classification";
import type { PortfolioTransaction } from "@/domain/portfolio";
import { type TransactionWire, decodeTransaction, fromWire, permitsChange, recordIssues } from "@/domain/portfolio/records";

import { COOKIE_OPTIONS } from "./account";
import { DEMO_COOKIES } from "./tiers";

/*
 * Demo mode's ledger, in a cookie of the same browser. `demo-portfolio-scenario` picks the starting
 * ledger: `full` (default), `partial` (one holding without a current quote), `empty`, or `invalid`
 * (an oversell). Every write applies the server's rules (contract §5.1) and refuses with its errors.
 */
const LEDGER_COOKIE = DEMO_COOKIES[9];
export const DEMO_PORTFOLIO_SCENARIO_COOKIE = DEMO_COOKIES[10];
export const DEMO_PORTFOLIO_SCENARIOS = ["full", "partial", "empty", "invalid"] as const;
type Scenario = (typeof DEMO_PORTFOLIO_SCENARIOS)[number];

/** A cookie holds about 4 KB: the demo keeps at most this many records. */
const LIMIT = 24;

const SECURITIES = new Map(
  recordedSnapshot.securities.map((security) => [
    security.id,
    { kind: classifySecurityKind({ type: security.security_type ?? "", name: security.name ?? undefined, symbol: security.symbol }), currency: security.currency ?? "AOA" },
  ]),
);

const BAI = "3c55bf40-8544-4598-bf76-15a165dbeff3";
const BCGA = "ec7084ad-90ac-4cd2-b481-1572d02e2488";
const BDVA = "51399e7d-8108-434a-b852-c6646a3e9579";
const BAI_BOND = "59c632cb-0072-4f56-95c8-650709d59615";
const UNQUOTED_BOND = "89b56ea1-2462-4375-8c36-9967ef56cb8b";

const row = (n: number, securityId: string, kind: TransactionWire["kind"], quantity: string, unitPrice: string, fees: string, tradedOn: string): TransactionWire => ({
  id: `d5e20000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  securityId,
  kind,
  quantity,
  unitPrice,
  fees,
  tradedOn,
  createdAt: `${tradedOn}T10:00:00.000Z`,
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
          const [id, securityId, kind, quantity, unitPrice, fees, tradedOn, createdAt] = Array.isArray(item) ? item : [];
          return decodeTransaction({ id, securityId, kind: { b: "buy", s: "sell", i: "income" }[kind as string], quantity, unitPrice, fees, tradedOn, createdAt });
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
  const compact = stored.rows.map((item) => [item.id, item.securityId, item.kind[0], item.quantity, item.unitPrice, item.fees, item.tradedOn, item.createdAt]);
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
    if (issues.some((issue) => issue === "unsupported" || issue === "wholeQuantity" || issue === "overflow")) throw sqlError("23514", "Unsupported portfolio instrument or quantity");
    const constraint = issues.includes("taxExceedsGross") || (changed.kind === "income" && issues.includes("quantity")) ? "income_shape" : "check";
    if (issues.length > 0) throw sqlError("23514", `new row for relation "portfolio_transactions" violates check constraint "portfolio_transactions_${constraint}"`);
  }
  const ledger = (rows: readonly TransactionWire[]): PortfolioTransaction[] => rows.map(fromWire);
  if (!permitsChange(ledger(before), ledger(after), now)) throw sqlError("23514", "Portfolio sale exceeds holdings");
}

export async function demoCreateTransaction(transaction: TransactionWire, now: number): Promise<void> {
  const stored = await read();
  if (stored.rows.some((item) => item.id === transaction.id)) return;
  const created = { ...transaction, createdAt: new Date(now).toISOString() };
  const rows = [...stored.rows, created];
  check(stored.rows, rows, created, now);
  await save({ revision: stored.revision, rows });
}

export async function demoUpdateTransaction(transaction: TransactionWire, now: number): Promise<void> {
  const stored = await read();
  const previous = stored.rows.find((item) => item.id === transaction.id);
  if (!previous) return;
  if (previous.securityId !== transaction.securityId) throw sqlError("23514", "Portfolio transaction identity cannot change");
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
