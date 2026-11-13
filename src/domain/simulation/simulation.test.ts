import { describe, expect, it } from "vitest";

import {
  EMPTY_DRAFT,
  EXAMPLE_DRAFT,
  MAXIMUM_AMOUNT,
  MAXIMUM_ANNUAL_RETURN,
  MAXIMUM_DURATION_MONTHS,
  SIMULATION_FIELDS,
  Sim,
  type SimDecimal,
  SimulationError,
  type SimulationInput,
  type SimulationInstrument,
  parseSimulationNumber,
  resultGain,
  simulate,
  simulateInstrument,
  validateDraft,
  validateDraftWith,
} from "./simulation";

// Ported from iOS `InvestmentSimulationTests`, `AssetInvestmentSimulationTests` and `SimulationDraftTests`.

const d = (value: string | number | SimDecimal) => new Sim(value);
const input = (initial: string, monthly: string, rate: string, months: number): SimulationInput => ({
  initialInvestment: parseSimulationNumber(initial)!,
  monthlyContribution: parseSimulationNumber(monthly)!,
  annualReturnPercent: parseSimulationNumber(rate)!,
  durationMonths: months,
});
const raw = (initial: SimDecimal | number, monthly: SimDecimal | number, rate: SimDecimal | number, months: number): SimulationInput => ({
  initialInvestment: d(initial),
  monthlyContribution: d(monthly),
  annualReturnPercent: d(rate),
  durationMonths: months,
});
const near = (actual: SimDecimal | undefined, expected: string, tolerance: string) =>
  expect(actual!.minus(expected).abs().lte(tolerance), `${actual} ≈ ${expected}`).toBe(true);
const failure = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error as SimulationError;
  }
  throw new Error("expected a SimulationError");
};

describe("generic projection", () => {
  it("adds contributions without growth at 0 %", () => {
    const result = simulate(input("1000,50", "100,25", "0", 12));
    expect(result.totalContributions.toString()).toBe("2203.5");
    expect(result.finalBalance.eq(result.totalContributions)).toBe(true);
    expect(result.monthlyPoints).toHaveLength(13);
    expect([result.monthlyPoints[0].balance.toString(), result.monthlyPoints[0].contributions.toString(), result.monthlyPoints.at(-1)!.month]).toEqual([
      "1000.5",
      "1000.5",
      12,
    ]);
  });

  it("uses the effective annual return and contributes at month end", () => {
    near(simulate(input("1000", "0", "10", 12)).finalBalance, "1100", "0.000000001");
    const monthEnd = simulate(input("0", "100", "12,6825030131969720661201", 2));
    expect(monthEnd.monthlyPoints[1].balance.toString()).toBe("100");
    near(monthEnd.finalBalance, "201", "0.000000001");
  });

  it("matches the independent fixtures", () => {
    const five = simulate(input("100000", "10000", "10", 60));
    near(five.finalBalance, "926663.30071531475708098083545541441410", "0.000001");
    expect(five.totalContributions.toString()).toBe("700000");
    const loss = simulate(input("1000", "100", "-50", 12));
    near(loss.finalBalance, "1390.8576872552883776745052788071501976", "0.000001");
    expect(resultGain(loss).isNegative() && loss.monthlyPoints[1].balance.lt(1100)).toBe(true);
    const fifty = simulate(input("250000", "15000", "7,5", 600));
    near(fifty.finalBalance, "99099498.090404779544530482046679227973", "0.0001");
    expect([fifty.monthlyPoints.length, fifty.totalContributions.toString()]).toEqual([601, "9250000"]);
  });

  it("keeps tiny money, tiny rates and rates near −100 % exact", () => {
    expect(simulate(input("0,001", "0,001", "0", 600)).finalBalance.toString()).toBe("0.601");
    near(resultGain(simulate(input("1000000000000", "0", "0,00000000000001", 600))), "0.005", "0.000000001");
    near(simulate(input("1000", "0", "-99,99999999999999999999999999", 1)).finalBalance, "4.6415888336127788924100763509194465766", "0.000000001");
    near(simulate(input("1000", "0", "-99,99999999999999", 1)).finalBalance, "46.415888336127788924100763509194465766", "0.000000001");
    expect(simulate(raw(1000, 0, d("1e-128"), 600)).finalBalance.toString()).toBe("1000");
  });

  it("stays finite at the limits and never goes negative", () => {
    const maximum = simulate({
      initialInvestment: MAXIMUM_AMOUNT,
      monthlyContribution: MAXIMUM_AMOUNT,
      annualReturnPercent: MAXIMUM_ANNUAL_RETURN,
      durationMonths: MAXIMUM_DURATION_MONTHS,
    });
    expect(maximum.finalBalance.isFinite() && maximum.totalContributions.eq(MAXIMUM_AMOUNT.times(601)) && resultGain(maximum).gt(0)).toBe(true);
    expect(simulate(input("0", "0", "-99", 600)).monthlyPoints.every((point) => point.balance.isZero() && point.contributions.isZero())).toBe(true);

    const collapse = simulate(input("1000", "0", "-99,9999", 600));
    expect([collapse.finalBalance.toString(), resultGain(collapse).toString()]).toEqual(["0", "-1000"]);
    for (let month = 1; month < collapse.monthlyPoints.length; month += 1)
      expect(collapse.monthlyPoints[month].balance.lte(collapse.monthlyPoints[month - 1].balance)).toBe(true);
    expect(collapse.monthlyPoints[187].balance.gt(0) && collapse.monthlyPoints[187].balance.lt("1e-90")).toBe(true);

    const tiny = simulate(raw(d("1e-120"), 0, 100, 600));
    expect(tiny.finalBalance.gt("1e-106") && tiny.finalBalance.lt("1e-104") && tiny.monthlyPoints.every((point) => point.balance.gt(0))).toBe(true);
  });

  it("rejects invalid inputs without clamping", () => {
    const baseline = raw(1000, 100, 5, 12);
    const cases: [SimulationInput, string][] = [];
    for (const amount of [d(-1), MAXIMUM_AMOUNT.plus(1), d(Number.NaN)]) {
      cases.push([{ ...baseline, initialInvestment: amount }, "initialInvestment"], [{ ...baseline, monthlyContribution: amount }, "monthlyContribution"]);
    }
    for (const rate of [-101, -100, 101, Number.NaN]) cases.push([{ ...baseline, annualReturnPercent: d(rate) }, "annualReturnPercent"]);
    for (const months of [-1, 0, 601, Number.MAX_SAFE_INTEGER]) cases.push([{ ...baseline, durationMonths: months }, "durationMonths"]);
    for (const [candidate, field] of cases)
      expect([failure(() => simulate(candidate)).kind, failure(() => simulate(candidate)).field]).toEqual(["invalidInput", field]);
  });
});

describe("instrument projection", () => {
  const asset = (price: SimDecimal | number, fractional = false, currency = "AOA"): SimulationInstrument => ({
    securityId: "BAI",
    symbol: "BAI",
    name: "Banco BAI",
    unitPrice: d(price),
    currencyCode: currency,
    allowsFractionalQuantity: fractional,
  });
  const ONE_PERCENT = d("12.6825030131969720661201");
  const str = (value: SimDecimal | undefined) => value?.toString();

  it("buys whole shares and carries the cash forward; funds buy fractions", () => {
    const whole = simulateInstrument(raw(1000, 100, 0, 2), asset(300));
    expect(
      [
        whole.initialQuantity,
        whole.monthlyPoints[0].cash,
        whole.monthlyPoints[1].quantity,
        whole.monthlyPoints[1].cash,
        whole.finalQuantity,
        whole.uninvestedCash,
        whole.finalBalance,
      ].map(str),
    ).toEqual(["3", "100", "3", "200", "4", "0", "1200"]);
    const fund = simulateInstrument(raw(1000, 100, 0, 2), asset(300, true));
    near(fund.initialQuantity, "3.3333333333333333333333333333333333333", "0.00000001");
    near(fund.finalQuantity, "4", "0.00000001");
    near(fund.finalBalance, "1200", "0.00000001");
  });

  it("buys at the projected month-end price and keeps cash out of returns", () => {
    const whole = simulateInstrument(raw(250, 60, ONE_PERCENT, 2), asset(100));
    expect([str(whole.initialQuantity), str(whole.finalQuantity), whole.totalContributions.toString()]).toEqual(["2", "3", "370"]);
    near(whole.monthlyPoints[1].cash, "9", "0.00000001");
    near(whole.finalUnitPrice, "102.01", "0.00000001");
    near(whole.uninvestedCash, "69", "0.00000001");
    near(whole.finalBalance, "375.03", "0.00000001");
    near(resultGain(whole), "5.03", "0.00000001");
    near(simulateInstrument(raw(250, 60, ONE_PERCENT, 2), asset(100, true)).finalBalance, "375.625", "0.00000001");
  });

  it("follows the latest quote", () => {
    const first = simulateInstrument(raw(250, 0, 10, 12), asset(100));
    const updated = simulateInstrument(raw(250, 0, 10, 12), asset(80));
    expect([first.initialQuantity, updated.initialQuantity, first.uninvestedCash, updated.uninvestedCash].map(str)).toEqual(["2", "3", "50", "10"]);
    near(first.finalBalance, "270", "0.00000001");
    near(updated.finalBalance, "274", "0.00000001");
    const fundFirst = simulateInstrument(raw(250, 0, 10, 12), asset(100, true));
    const fundUpdated = simulateInstrument(raw(250, 0, 10, 12), asset(80, true));
    expect([str(fundFirst.initialQuantity), str(fundUpdated.initialQuantity)]).toEqual(["2.5", "3.125"]);
    near(fundFirst.finalBalance, "275", "0.00000001");
    near(fundUpdated.finalBalance, "275", "0.00000001");
  });

  it("keeps a budget below one share as cash, and a falling price never reduces cash", () => {
    const small = simulateInstrument(raw(50, 30, 0, 2), asset(100));
    expect(
      [small.initialQuantity, small.monthlyPoints[1].quantity, small.monthlyPoints[1].cash, small.finalQuantity, small.uninvestedCash, small.finalBalance].map(
        str,
      ),
    ).toEqual(["0", "0", "80", "1", "10", "110"]);
    const falling = simulateInstrument(raw(250, 0, -50, 12), asset(100));
    expect(str(falling.initialQuantity)).toBe("2");
    near(falling.finalBalance, "150", "0.00000001");
    expect(falling.monthlyPoints.every((point) => point.cash!.gte(0))).toBe(true);
  });

  it("refuses missing, mismatched and invalid quotes", () => {
    const draft = { ...EXAMPLE_DRAFT, securityId: "BAI" };
    for (const candidate of [null, { ...asset(100), securityId: "BCG" }, asset(0), asset(-1), asset(Number.NaN), asset(100, false, "USD")]) {
      const validation = validateDraftWith(draft, candidate);
      expect(validation.result === null && validation.instrumentError !== null).toBe(true);
    }
    expect(validateDraftWith(draft, asset(100)).result).not.toBeNull();
    for (const candidate of [asset(0), asset(-1), asset(Number.NaN), asset(100, false, "USD")])
      expect(failure(() => simulateInstrument(raw(1000, 0, 5, 12), candidate)).kind).toBe("invalidInstrument");
  });

  it("fails visibly when a price or a fund quantity cannot be represented", () => {
    expect(failure(() => simulateInstrument(raw(1000, 100, d("-99.9999"), 600), asset(100))).kind).toBe("arithmeticOverflow");
    const validation = validateDraftWith(
      {
        initialInvestment: "1000",
        monthlyContribution: "100",
        annualReturnPercent: "-99,9999",
        durationMonths: "600",
        securityId: "BAI",
      },
      asset(100),
    );
    expect([validation.result, validation.errors.annualReturnPercent]).toEqual([null, "simulation.validation.precisionExceeded"]);
    expect(failure(() => simulateInstrument(raw(d("1e-128"), 0, 0, 1), asset(1000, true))).kind).toBe("arithmeticOverflow");
  });

  it("drops the result while a draft is incomplete", () => {
    const draft = { ...EXAMPLE_DRAFT, securityId: "BAI" };
    expect(validateDraftWith(draft, asset(100)).result).not.toBeNull();
    expect(validateDraftWith({ ...draft, annualReturnPercent: "5," }, asset(100)).result).toBeNull();
  });
});

describe("draft and parser", () => {
  it("starts from a visible zero-return baseline that needs an initial amount; the example is valid", () => {
    expect(Object.keys(validateDraft(EMPTY_DRAFT).errors)).toEqual(["initialInvestment"]);
    const example = validateDraft(EXAMPLE_DRAFT);
    expect([
      example.input?.initialInvestment.toString(),
      example.input?.monthlyContribution.toString(),
      example.input?.annualReturnPercent.toString(),
      example.input?.durationMonths,
    ]).toEqual(["100000", "10000", "10", 60]);
    expect(validateDraft({ ...EXAMPLE_DRAFT, annualReturnPercent: "10," })).toMatchObject({ input: null, result: null });
  });

  it("reports every field's error together", () => {
    const all = validateDraft({
      initialInvestment: "-1",
      monthlyContribution: "1000000000001",
      annualReturnPercent: "-100",
      durationMonths: "601",
      securityId: null,
    });
    expect(Object.keys(all.errors).sort()).toEqual([...SIMULATION_FIELDS].sort());
    expect(
      Object.keys(
        validateDraft({
          initialInvestment: "",
          monthlyContribution: "-1",
          annualReturnPercent: "5",
          durationMonths: "60",
          securityId: null,
        }).errors,
      ).sort(),
    ).toEqual(["initialInvestment", "monthlyContribution"]);
  });

  it("needs whole months between 1 and 600", () => {
    for (const text of ["", "0", "-1", "601", "12,5", "12.0", "1 000", "12 months", "1e2", "999999999999999999999999999"])
      expect(validateDraft({ ...EXAMPLE_DRAFT, durationMonths: text }).errors.durationMonths, text).toBeDefined();
    for (const text of ["1", "12", "600", " 60 "]) expect(validateDraft({ ...EXAMPLE_DRAFT, durationMonths: text }).result, text).not.toBeNull();
    for (const rate of ["-99,9", "-5", "0", "100"]) expect(validateDraft({ ...EXAMPLE_DRAFT, annualReturnPercent: rate }).result, rate).not.toBeNull();
  });

  it("reads Portuguese numbers and rejects anything ambiguous", () => {
    const accepted: [string, string][] = [
      ["1234,56", "1234.56"],
      ["1.234,56", "1234.56"],
      ["1 234,56", "1234.56"],
      ["1 234,56", "1234.56"],
      ["1 234,56", "1234.56"],
      ["1.234.567,89", "1234567.89"],
      ["  -12,5  ", "-12.5"],
      ["+5", "5"],
      ["0,001", "0.001"],
      ["00100,50", "100.5"],
    ];
    for (const [text, expected] of accepted) expect(parseSimulationNumber(text)?.toString(), text).toBe(expected);
    const rejected = [
      ...[
        "",
        " ",
        "-",
        "+",
        ",",
        "10,",
        ",5",
        "10.",
        "12.5",
        "1,234.56",
        "1.2.3,45",
        "1.23,45",
        "1 23,45",
        "1.234 567,89",
        "1 234.567,89",
        "1234 567",
        "1,,5",
        "1,2,3",
      ],
      ...["1  000", "1\t000", "1\n000", "1e3", "0x10", "100 Kz", "NaN", "nan", "Infinity", "inf", "-∞", "5%", "123abc", "１２３"],
      "9".repeat(200),
      `0,${"0".repeat(200)}1`,
      `0,${"1".repeat(39)}`,
    ];
    for (const text of rejected) expect(parseSimulationNumber(text), JSON.stringify(text)).toBeNull();
    expect(parseSimulationNumber(`0,${"1".repeat(38)}`)).not.toBeNull();
  });
});
