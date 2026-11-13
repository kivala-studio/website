import Decimal from "decimal.js";

import { parseAmount } from "@/domain/format/amount-input";

/*
 * iOS `InvestmentSimulation`: a hypothetical projection, independent of market data and portfolio records.
 * Arithmetic mirrors Foundation's `Decimal`: 38 significant digits, half away from zero (`.plain`) unless a
 * step rounds down, and nothing smaller than 1e-128 (Decimal's exponent floor) survives. Money is never
 * rounded to currency between months; only the monthly growth factor passes through a double, once.
 */

const LIMITS = {
  precision: 38,
  minE: -128,
  maxE: 165,
  toExpNeg: -9e15,
  toExpPos: 9e15,
} as const;
/** `.plain` rounding. */
export const Sim = Decimal.clone({
  ...LIMITS,
  rounding: Decimal.ROUND_HALF_UP,
});
/** `.down` rounding: quotients and purchase costs. */
const SimDown = Decimal.clone({ ...LIMITS, rounding: Decimal.ROUND_DOWN });

export type SimDecimal = InstanceType<typeof Sim>;

export const MAXIMUM_AMOUNT = new Sim("1000000000000");
export const MAXIMUM_ANNUAL_RETURN = new Sim(100);
export const MAXIMUM_DURATION_MONTHS = 600;

/** Scenario order on screen. */
export const SIMULATION_FIELDS = ["initialInvestment", "monthlyContribution", "durationMonths", "annualReturnPercent"] as const;
export type SimulationField = (typeof SIMULATION_FIELDS)[number];
/** iOS `SimulationField.allCases`: the order validation reports the first failing field in. */
const VALIDATION_ORDER: readonly SimulationField[] = ["initialInvestment", "monthlyContribution", "annualReturnPercent", "durationMonths"];

export type SimulationInput = {
  initialInvestment: SimDecimal;
  monthlyContribution: SimDecimal;
  annualReturnPercent: SimDecimal;
  durationMonths: number;
};

/** A verified monetary quote for an eligible equity or fund, never a bond percentage. */
export type SimulationInstrument = {
  securityId: string;
  symbol: string;
  name: string;
  unitPrice: SimDecimal;
  currencyCode: string;
  allowsFractionalQuantity: boolean;
};

export type SimulationPoint = {
  month: number;
  balance: SimDecimal;
  contributions: SimDecimal;
  quantity?: SimDecimal;
  unitPrice?: SimDecimal;
  cash?: SimDecimal;
};

export type SimulationResult = {
  input: SimulationInput;
  monthlyPoints: SimulationPoint[];
  finalBalance: SimDecimal;
  totalContributions: SimDecimal;
  instrument?: SimulationInstrument;
  initialQuantity?: SimDecimal;
  finalQuantity?: SimDecimal;
  finalUnitPrice?: SimDecimal;
  uninvestedCash?: SimDecimal;
};

export const resultGain = (result: Pick<SimulationResult, "finalBalance" | "totalContributions">) => result.finalBalance.minus(result.totalContributions);

/** Message keys; the domain stays free of copy. */
export const SIMULATION_MESSAGES = {
  amountRange: "common.amountRangeError",
  rateRange: "legacy.introduzaUmaTaxaSuperiorA100",
  durationRange: "simulation.validation.durationRange",
  wholeMonths: "simulation.validation.wholeMonths",
  fieldRequired: "simulation.validation.fieldRequired",
  invalidNumber: "simulation.validation.invalidNumber",
  selectAsset: "simulation.validation.selectAsset",
  noValidQuote: "simulation.validation.noValidQuote",
  unsupportedCurrency: "simulation.validation.unsupportedCurrency",
  precisionExceeded: "simulation.validation.precisionExceeded",
  calculationFailed: "simulation.validation.calculationFailed",
} as const;
export type SimulationMessage = (typeof SIMULATION_MESSAGES)[keyof typeof SIMULATION_MESSAGES];

export class SimulationError extends Error {
  constructor(
    readonly kind: "invalidInput" | "invalidInstrument" | "arithmeticOverflow",
    readonly field?: SimulationField,
  ) {
    super(field ? `${kind}:${field}` : kind);
  }
}

const overflow = () => new SimulationError("arithmeticOverflow");

export function instrumentError(instrument: SimulationInstrument): SimulationMessage | null {
  if (instrument.currencyCode.toUpperCase() !== "AOA") return SIMULATION_MESSAGES.unsupportedCurrency;
  if (instrument.unitPrice.isNaN() || !instrument.unitPrice.gt(0)) return SIMULATION_MESSAGES.noValidQuote;
  return null;
}

const isValidAmount = (amount: SimDecimal) => !amount.isNaN() && amount.gte(0) && amount.lte(MAXIMUM_AMOUNT);

export function validationErrors(input: SimulationInput): Partial<Record<SimulationField, SimulationMessage>> {
  const errors: Partial<Record<SimulationField, SimulationMessage>> = {};
  if (!isValidAmount(input.initialInvestment)) errors.initialInvestment = SIMULATION_MESSAGES.amountRange;
  if (!isValidAmount(input.monthlyContribution)) errors.monthlyContribution = SIMULATION_MESSAGES.amountRange;
  const rate = input.annualReturnPercent;
  if (rate.isNaN() || rate.lte(-100) || rate.gt(MAXIMUM_ANNUAL_RETURN)) errors.annualReturnPercent = SIMULATION_MESSAGES.rateRange;
  if (!Number.isInteger(input.durationMonths) || input.durationMonths < 1 || input.durationMonths > MAXIMUM_DURATION_MONTHS)
    errors.durationMonths = SIMULATION_MESSAGES.durationRange;
  return errors;
}

function assertValid(input: SimulationInput) {
  const errors = validationErrors(input);
  const field = VALIDATION_ORDER.find((item) => errors[item] !== undefined);
  if (field) throw new SimulationError("invalidInput", field);
}

/**
 * log1p/expm1 keep small rates accurate; one conversion back through the shortest decimal string of the
 * double. Rates below −50 % take the logarithm of the exact decimal growth so 1 + r keeps its digits.
 */
export function monthlyGrowthFactor(annualReturnPercent: SimDecimal): SimDecimal {
  if (annualReturnPercent.isZero()) return new Sim(1);
  const annualRate = Number(annualReturnPercent.toString()) / 100;
  const annualLog = annualRate >= -0.5 ? Math.log1p(annualRate) : Math.log(Number(new Sim(1).plus(annualReturnPercent.div(100)).toString()));
  const rate = Math.expm1(annualLog / 12);
  // A monthly rate below Decimal's smallest exponent cannot change a representable factor.
  if (Math.abs(rate) < 1e-128) return new Sim(1);
  if (!Number.isFinite(rate)) throw overflow();
  return new Sim(1).plus(new Sim(String(rate)));
}

function checked(value: Decimal): SimDecimal {
  if (value.isNaN() || !value.isFinite() || value.isNegative()) throw overflow();
  return new Sim(value);
}

function multiply(amount: SimDecimal, factor: SimDecimal, { down = false, nonzero = false } = {}): SimDecimal {
  if (amount.isZero()) return new Sim(0);
  const product = down ? new SimDown(amount).times(factor) : amount.times(factor);
  if (nonzero && product.isZero()) throw overflow();
  return checked(product);
}

function add(first: SimDecimal, second: SimDecimal): SimDecimal {
  if (first.isZero()) return second;
  if (second.isZero()) return first;
  const result = first.plus(second);
  if (result.isNaN() || !result.isFinite() || result.lt(first) || result.lt(second)) throw overflow();
  return result;
}

function purchase(budget: SimDecimal, price: SimDecimal, fractional: boolean): { quantity: SimDecimal; cash: SimDecimal } {
  if (!budget.gt(0)) return { quantity: new Sim(0), cash: new Sim(0) };
  const quotient = new SimDown(budget).div(price);
  // A fund purchase too small to represent would silently lose the budget.
  if (fractional && quotient.isZero()) throw overflow();
  const quantity = new Sim(fractional ? quotient : quotient.toDecimalPlaces(0, Decimal.ROUND_DOWN));
  const cost = multiply(quantity, price, { down: true });
  if (cost.gt(budget)) throw overflow();
  const cash = budget.minus(cost);
  if (cash.isNaN() || cash.isNegative() || cash.gt(budget)) throw overflow();
  return { quantity, cash };
}

/** Generic projection: grow the previous balance, then contribute at month end. */
export function simulate(input: SimulationInput): SimulationResult {
  assertValid(input);
  const growth = monthlyGrowthFactor(input.annualReturnPercent);
  const falling = input.annualReturnPercent.isNegative();
  let balance = input.initialInvestment;
  let contributions = input.initialInvestment;
  const points: SimulationPoint[] = [{ month: 0, balance, contributions }];
  for (let month = 1; month <= input.durationMonths; month += 1) {
    const grown = multiply(balance, growth);
    if (falling && grown.gt(balance)) throw overflow();
    balance = add(grown, input.monthlyContribution);
    contributions = add(contributions, input.monthlyContribution);
    points.push({ month, balance, contributions });
  }
  return {
    input,
    monthlyPoints: points,
    finalBalance: balance,
    totalContributions: contributions,
  };
}

/**
 * Buys units at the latest monetary quote, then projects the price with the user's assumption only. Unspent
 * cash stays without interest; distributions, fees, taxes and inflation are not included.
 */
export function simulateInstrument(input: SimulationInput, instrument: SimulationInstrument): SimulationResult {
  assertValid(input);
  if (instrumentError(instrument)) throw new SimulationError("invalidInstrument");
  const growth = monthlyGrowthFactor(input.annualReturnPercent);
  const falling = input.annualReturnPercent.isNegative();
  const fractional = instrument.allowsFractionalQuantity;
  let price = instrument.unitPrice;
  const initial = purchase(input.initialInvestment, price, fractional);
  let quantity = initial.quantity;
  let cash = initial.cash;
  let contributions = input.initialInvestment;
  let balance = add(multiply(quantity, price), cash);
  const points: SimulationPoint[] = [{ month: 0, balance, contributions, quantity, unitPrice: price, cash }];
  for (let month = 1; month <= input.durationMonths; month += 1) {
    const next = multiply(price, growth, { nonzero: true });
    if (!next.gt(0) || (falling && next.gt(price))) throw overflow();
    price = next;
    const bought = purchase(add(cash, input.monthlyContribution), price, fractional);
    quantity = add(quantity, bought.quantity);
    cash = bought.cash;
    contributions = add(contributions, input.monthlyContribution);
    balance = add(multiply(quantity, price), cash);
    points.push({
      month,
      balance,
      contributions,
      quantity,
      unitPrice: price,
      cash,
    });
  }
  return {
    input,
    monthlyPoints: points,
    finalBalance: balance,
    totalContributions: contributions,
    instrument,
    initialQuantity: initial.quantity,
    finalQuantity: quantity,
    finalUnitPrice: price,
    uninvestedCash: cash,
  };
}

// MARK: Parsing and the draft

/** iOS `SimulationNumberParser` (shared with amount fields), in simulator precision. */
export function parseSimulationNumber(text: string): SimDecimal | null {
  const value = parseAmount(text);
  if (value === null) return null;
  const result = new Sim(value);
  // Below Decimal's exponent floor a nonzero entry would silently become zero.
  return result.isZero() && !value.isZero() ? null : result;
}

export type SimulationDraft = {
  initialInvestment: string;
  monthlyContribution: string;
  annualReturnPercent: string;
  durationMonths: string;
  securityId: string | null;
};

/** A visible zero-return baseline that still needs an initial amount. */
export const EMPTY_DRAFT: SimulationDraft = {
  initialInvestment: "",
  monthlyContribution: "0",
  annualReturnPercent: "0",
  durationMonths: "60",
  securityId: null,
};
export const EXAMPLE_DRAFT: SimulationDraft = {
  initialInvestment: "100000",
  monthlyContribution: "10000",
  annualReturnPercent: "10",
  durationMonths: "60",
  securityId: null,
};

export type SimulationValidation = {
  input: SimulationInput | null;
  errors: Partial<Record<SimulationField, SimulationMessage>>;
  result: SimulationResult | null;
  instrumentError: SimulationMessage | null;
};

/** Every field's error at once, so each visible error belongs to the field that needs it. */
export function validateDraft(draft: SimulationDraft): SimulationValidation {
  const errors: Partial<Record<SimulationField, SimulationMessage>> = {};
  const parse = (field: SimulationField, text: string) => {
    const value = parseSimulationNumber(text);
    if (value === null) errors[field] = text.trim() === "" ? SIMULATION_MESSAGES.fieldRequired : SIMULATION_MESSAGES.invalidNumber;
    return value;
  };
  const initial = parse("initialInvestment", draft.initialInvestment);
  const monthly = parse("monthlyContribution", draft.monthlyContribution);
  const annual = parse("annualReturnPercent", draft.annualReturnPercent);
  const durationText = draft.durationMonths.trim();
  // Swift's Int(text) fails beyond Int.max; anything that long is out of range anyway.
  const duration = /^[0-9]+$/.test(durationText) && durationText.length <= 18 ? Number(durationText) : null;
  if (duration === null) errors.durationMonths = SIMULATION_MESSAGES.wholeMonths;
  const candidate: SimulationInput = {
    initialInvestment: initial ?? new Sim(0),
    monthlyContribution: monthly ?? new Sim(0),
    annualReturnPercent: annual ?? new Sim(0),
    durationMonths: duration ?? 1,
  };
  for (const [field, message] of Object.entries(validationErrors(candidate)) as [SimulationField, SimulationMessage][]) errors[field] ??= message;
  if (Object.keys(errors).length > 0) return { input: null, errors, result: null, instrumentError: null };
  try {
    return {
      input: candidate,
      errors: {},
      result: simulate(candidate),
      instrumentError: null,
    };
  } catch {
    return {
      input: null,
      errors: { annualReturnPercent: SIMULATION_MESSAGES.calculationFailed },
      result: null,
      instrumentError: null,
    };
  }
}

/** The same draft against the selected instrument's quote. */
export function validateDraftWith(draft: SimulationDraft, instrument: SimulationInstrument | null | undefined): SimulationValidation {
  const validation = validateDraft(draft);
  if (!instrument || instrument.securityId !== draft.securityId)
    return {
      input: null,
      errors: validation.errors,
      result: null,
      instrumentError: SIMULATION_MESSAGES.selectAsset,
    };
  const quoteError = instrumentError(instrument);
  if (quoteError)
    return {
      input: null,
      errors: validation.errors,
      result: null,
      instrumentError: quoteError,
    };
  if (!validation.input) return validation;
  try {
    return {
      input: validation.input,
      errors: {},
      result: simulateInstrument(validation.input, instrument),
      instrumentError: null,
    };
  } catch {
    return {
      input: null,
      errors: { annualReturnPercent: SIMULATION_MESSAGES.precisionExceeded },
      result: null,
      instrumentError: null,
    };
  }
}
