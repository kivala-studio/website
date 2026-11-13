import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { LEDGER_PAGE_SIZE, readLedger } = await import("./portfolio");

const row = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  security_id: "3c55bf40-8544-4598-bf76-15a165dbeff3",
  transaction_kind: "buy",
  quantity: "1",
  unit_price: "100",
  fees: "0",
  traded_on: "2026-11-02",
  created_at: `2026-11-02T09:00:00.${String(n).padStart(6, "0")}+00:00`,
  portfolio_id: null,
});
const page = (revision: string, from: number, count: number) => ({ data: { revision, transactions: Array.from({ length: count }, (_, i) => row(from + i)) }, error: null });

describe("readLedger", () => {
  it("pages by keyset at one revision and restarts when the ledger changes", async () => {
    const calls: Record<string, string>[] = [];
    const answers = [
      page("7", 1, LEDGER_PAGE_SIZE),
      { data: null, error: { code: "PT409", message: "Portfolio changed; reload before calculating totals" } },
      page("8", 1, LEDGER_PAGE_SIZE),
      page("9", 501, 1),
      page("9", 1, LEDGER_PAGE_SIZE),
      page("9", 501, 2),
    ];
    const ledger = await readLedger({} as never, async (args) => {
      calls.push(args);
      return answers.shift()!;
    });
    expect(ledger.revision).toBe("9");
    expect(ledger.transactions).toHaveLength(LEDGER_PAGE_SIZE + 2);
    expect(calls.map((args) => args.expected_revision ?? "-")).toEqual(["-", "7", "-", "8", "-", "9"]);
    expect(calls[5]).toEqual({ expected_revision: "9", after_traded_on: "2026-11-02", after_created_at: row(500).created_at, after_id: row(500).id });
  });

  it("rejects the whole ledger for one malformed row", async () => {
    await expect(readLedger({} as never, async () => ({ data: { revision: "1", transactions: [{ ...row(1), quantity: "NaN" }] }, error: null }))).rejects.toThrow();
  });
});
