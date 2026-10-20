import Decimal from "decimal.js";
import type { Transaction } from "./account-data";
Decimal.set({ precision: 38 });
export const todayLuanda = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export type Position = {
  securityID: string;
  quantity: Decimal;
  cost: Decimal;
  average: Decimal;
  realized: Decimal;
};
export function positions(
  transactions: Transaction[],
  today = todayLuanda(),
): Position[] {
  const values = new Map<string, Position>();
  const ids = new Set<string>();
  const ordered = [...transactions].sort(
    (a, b) =>
      a.traded_on.localeCompare(b.traded_on) ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  );
  for (const t of ordered) {
    const quantity = new Decimal(t.quantity),
      price = new Decimal(t.unit_price);
    if (
      ids.has(t.id) ||
      !quantity.isFinite() ||
      !price.isFinite() ||
      quantity.lte(0) ||
      price.lte(0) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(t.traded_on) ||
      !Number.isFinite(Date.parse(t.traded_on)) ||
      new Date(t.traded_on).toISOString().slice(0, 10) !== t.traded_on ||
      t.traded_on > today ||
      !Number.isFinite(Date.parse(t.created_at))
    )
      throw new Error(
        "Registo de carteira inválido. Revê as operações antes de calcular os totais.",
      );
    ids.add(t.id);
    const p = values.get(t.security_id) || {
      securityID: t.security_id,
      quantity: new Decimal(0),
      cost: new Decimal(0),
      average: new Decimal(0),
      realized: new Decimal(0),
    };
    if (t.transaction_kind === "buy") {
      p.cost = p.cost.plus(quantity.times(price));
      p.quantity = p.quantity.plus(quantity);
    } else if (t.transaction_kind === "sell") {
      if (quantity.gt(p.quantity))
        throw new Error(
          "A venda excede a quantidade disponível na data indicada.",
        );
      const soldCost = p.average.times(quantity);
      p.realized = p.realized.plus(quantity.times(price).minus(soldCost));
      p.cost = p.cost.minus(soldCost);
      p.quantity = p.quantity.minus(quantity);
      if (p.quantity.isZero()) p.cost = new Decimal(0);
    } else throw new Error("Tipo de operação inválido.");
    p.average = p.quantity.gt(0) ? p.cost.div(p.quantity) : new Decimal(0);
    values.set(t.security_id, p);
  }
  return [...values.values()];
}
export type SimulationInput = {
  initial: string;
  monthly: string;
  annual: string;
  months: number;
};
export type SimulationPoint = {
  date: string;
  value: number;
  contributions: number;
};
export function simulate(
  input: SimulationInput,
  instrument?: { price: number; fractional: boolean },
) {
  const initial = new Decimal(input.initial),
    monthly = new Decimal(input.monthly),
    annual = new Decimal(input.annual);
  if (
    ![initial, monthly, annual].every((value) => value.isFinite()) ||
    initial.lt(0) ||
    monthly.lt(0) ||
    initial.gt(1e12) ||
    monthly.gt(1e12) ||
    annual.lte(-100) ||
    annual.gt(100) ||
    !Number.isInteger(input.months) ||
    input.months < 1 ||
    input.months > 600
  )
    throw new Error(
      "Revê os valores: montantes de 0 a 1 bilião Kz, taxa superior a −100% até 100% e prazo de 1 a 600 meses.",
    );
  if (
    instrument &&
    (!Number.isFinite(instrument.price) || instrument.price <= 0)
  )
    throw new Error("Cotação indisponível para simulação.");
  const growth = new Decimal(1)
    .plus(annual.div(100))
    .pow(new Decimal(1).div(12));
  let balance = initial,
    contributions = initial,
    quantity = new Decimal(0),
    cash = new Decimal(0),
    price = new Decimal(instrument?.price || 1);
  function purchase(budget: Decimal) {
    const affordable = budget.div(price);
    const units = instrument?.fractional ? affordable : affordable.floor();
    quantity = quantity.plus(units);
    cash = budget.minus(units.times(price));
    balance = quantity.times(price).plus(cash);
  }
  if (instrument) purchase(initial);
  const points: SimulationPoint[] = [
    {
      date: "0",
      value: balance.toNumber(),
      contributions: contributions.toNumber(),
    },
  ];
  for (let month = 1; month <= input.months; month++) {
    if (instrument) {
      price = price.times(growth);
      purchase(cash.plus(monthly));
    } else balance = balance.times(growth).plus(monthly);
    contributions = contributions.plus(monthly);
    if (!balance.isFinite() || !Number.isFinite(balance.toNumber()))
      throw new Error("A projecção excede os limites de cálculo.");
    points.push({
      date: String(month),
      value: balance.toNumber(),
      contributions: contributions.toNumber(),
    });
  }
  return {
    points,
    balance: balance.toNumber(),
    contributions: contributions.toNumber(),
    gain: balance.minus(contributions).toNumber(),
    quantity: quantity.toNumber(),
    cash: cash.toNumber(),
    price: price.toNumber(),
  };
}

export type HistoricalPrice = { trading_date: string; close_price: number };
/** Match native history: exact-day marks for every open position; never carry prices forward. */
export function portfolioHistory(
  transactions: Transaction[],
  histories: Record<string, HistoricalPrice[]>,
  today = todayLuanda(),
) {
  positions(transactions, today);
  const prices = new Map<string, Map<string, number>>();
  const days = new Set<string>();
  for (const [id, rows] of Object.entries(histories)) {
    const byDay = new Map<string, number>();
    for (const row of rows) {
      const day = row.trading_date;
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(Date.parse(day)) ||
        new Date(day).toISOString().slice(0, 10) !== day ||
        day > today ||
        !Number.isFinite(row.close_price) ||
        row.close_price <= 0 ||
        byDay.has(day)
      )
        throw new Error("Histórico inválido ou duplicado.");
      byDay.set(day, row.close_price);
      days.add(day);
    }
    prices.set(id, byDay);
  }
  return [...days].sort().flatMap((day) => {
    const active = transactions.filter((t) => t.traded_on <= day);
    if (!active.length) return [];
    const held = positions(active, today).filter((p) => p.quantity.gt(0));
    let total = new Decimal(0);
    for (const position of held) {
      const price = prices.get(position.securityID)?.get(day);
      if (price === undefined) return [];
      total = total.plus(position.quantity.times(price));
    }
    return [{ day, value: total.toNumber() }];
  });
}
