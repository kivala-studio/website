import test from "node:test";
import assert from "node:assert/strict";
import { positions, simulate, portfolioHistory } from "../lib/finance.ts";

const trade = (id, kind, quantity, price, day = "2026-09-01") => ({
  id,
  security_id: "asset",
  transaction_kind: kind,
  quantity,
  unit_price: price,
  traded_on: day,
  created_at: `2026-09-01T10:00:0${id}Z`,
});
test("weighted average cost is reduced proportionally on sale", () => {
  const [p] = positions(
    [
      trade("1", "buy", "10", "100"),
      trade("2", "buy", "10", "200"),
      trade("3", "sell", "5", "220"),
    ],
    "2026-10-18",
  );
  assert.equal(p.quantity.toString(), "15");
  assert.equal(p.cost.toString(), "2250");
  assert.equal(p.average.toString(), "150");
  assert.equal(p.realized.toString(), "350");
});
test("backdated sells cannot borrow units from later purchases", () => {
  assert.throws(
    () =>
      positions(
        [
          trade("1", "buy", 10, 100, "2026-09-02"),
          trade("2", "sell", 5, 110, "2026-09-01"),
        ],
        "2026-10-18",
      ),
    /excede/,
  );
});
test("fractional lots preserve decimal arithmetic", () => {
  const [p] = positions(
    [trade("1", "buy", "0.1", "0.2"), trade("2", "buy", "0.2", "0.2")],
    "2026-10-18",
  );
  assert.equal(p.quantity.toString(), "0.3");
  assert.equal(p.cost.toString(), "0.06");
});
test("zero return retains every month-end contribution", () => {
  const result = simulate({
    initial: "1000",
    monthly: "100",
    annual: "0",
    months: 12,
  });
  assert.equal(result.balance, 2200);
  assert.equal(result.gain, 0);
  assert.equal(result.points.length, 13);
});
test("effective annual return compounds to the stated annual assumption", () => {
  const result = simulate({
    initial: "1000",
    monthly: "0",
    annual: "10",
    months: 12,
  });
  assert.ok(Math.abs(result.balance - 1100) < 1e-8);
});
test("whole-unit simulation retains uninvested cash", () => {
  const result = simulate(
    { initial: "100", monthly: "10", annual: "0", months: 2 },
    { price: 30, fractional: false },
  );
  assert.equal(result.quantity, 4);
  assert.equal(result.cash, 0);
  assert.equal(result.balance, 120);
});
test("invalid projections and ledger dates fail closed", () => {
  assert.throws(() =>
    simulate({ initial: "1000", monthly: "100", annual: "-100", months: 12 }),
  );
  assert.throws(() =>
    simulate({ initial: "1000", monthly: "100", annual: "10", months: 601 }),
  );
  assert.throws(() =>
    positions([trade("1", "buy", 1, 1, "2026-02-30")], "2026-10-18"),
  );
});

test("portfolio history excludes missing marks and respects transaction dates", () => {
  const transactions = [
    trade("1", "buy", 2, 100),
    { ...trade("2", "buy", 3, 200, "2026-09-02"), security_id: "other" },
    trade("3", "sell", 1, 110, "2026-09-03"),
  ];
  const histories = {
    asset: [1, 2, 3, 4].map((day) => ({
      trading_date: `2026-09-0${day}`,
      close_price: 110,
    })),
    other: [{ trading_date: "2026-09-03", close_price: 220 }],
  };
  assert.deepEqual(portfolioHistory(transactions, histories, "2026-10-18"), [
    { day: "2026-09-01", value: 220 },
    { day: "2026-09-03", value: 770 },
  ]);
  assert.throws(
    () =>
      portfolioHistory(
        transactions,
        { asset: [histories.asset[0], histories.asset[0]] },
        "2026-10-18",
      ),
    /duplicado/,
  );
});
